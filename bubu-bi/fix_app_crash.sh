#!/bin/bash

# Wails应用闪退问题自动修复脚本
# 作者: AI Assistant
# 日期: $(date +%Y-%m-%d)

set -e

echo "🔧 开始诊断和修复Wails应用闪退问题..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="$(pwd)"
APP_PATH="$PROJECT_DIR/build/bin/bubu.app"
EXE_PATH="$APP_PATH/Contents/MacOS/bubu"

echo -e "${BLUE}📁 项目目录: $PROJECT_DIR${NC}"
echo -e "${BLUE}📱 应用路径: $APP_PATH${NC}"

# 1. 检查Wails环境
echo -e "\n${YELLOW}1. 检查Wails环境...${NC}"
if ! command -v wails &> /dev/null; then
    echo -e "${RED}❌ Wails未安装，请先安装Wails${NC}"
    exit 1
fi

WAILS_VERSION=$(wails version 2>/dev/null | head -n1 || echo "未知版本")
echo -e "${GREEN}✅ Wails版本: $WAILS_VERSION${NC}"

# 2. 清理旧的构建文件
echo -e "\n${YELLOW}2. 清理旧的构建文件...${NC}"
if [ -d "build/bin" ]; then
    rm -rf build/bin
    echo -e "${GREEN}✅ 已清理旧的构建文件${NC}"
fi

# 3. 检查前端依赖
echo -e "\n${YELLOW}3. 检查前端依赖...${NC}"
cd frontend
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    echo -e "${YELLOW}⚠️  重新安装前端依赖...${NC}"
    npm install
fi
echo -e "${GREEN}✅ 前端依赖检查完成${NC}"
cd ..

# 4. 更新go.mod
echo -e "\n${YELLOW}4. 更新Go模块...${NC}"
go mod tidy
echo -e "${GREEN}✅ Go模块更新完成${NC}"

# 5. 构建应用
echo -e "\n${YELLOW}5. 构建应用...${NC}"
echo -e "${BLUE}执行命令: wails build -clean -v 2 -trimpath${NC}"
if wails build -clean -v 2 -trimpath; then
    echo -e "${GREEN}✅ 应用构建成功${NC}"
else
    echo -e "${RED}❌ 应用构建失败${NC}"
    exit 1
fi

# 6. 检查应用包结构
echo -e "\n${YELLOW}6. 检查应用包结构...${NC}"
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}❌ 应用包不存在: $APP_PATH${NC}"
    exit 1
fi

if [ ! -f "$EXE_PATH" ]; then
    echo -e "${RED}❌ 可执行文件不存在: $EXE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 应用包结构正常${NC}"

# 7. 修复代码签名
echo -e "\n${YELLOW}7. 修复代码签名...${NC}"
echo -e "${BLUE}重新签名应用...${NC}"
if codesign --force --deep --sign - "$APP_PATH" 2>/dev/null; then
    echo -e "${GREEN}✅ 代码签名修复成功${NC}"
else
    echo -e "${YELLOW}⚠️  代码签名修复失败，但可能不影响运行${NC}"
fi

# 8. 测试应用启动
echo -e "\n${YELLOW}8. 测试应用启动...${NC}"
echo -e "${BLUE}启动应用进行测试...${NC}"

# 创建测试脚本
cat > test_app.sh << 'EOF'
#!/bin/bash
# 启动应用并在后台运行
"$1" &
APP_PID=$!
echo "应用PID: $APP_PID"

# 等待3秒检查应用是否还在运行
sleep 3

# 检查进程是否还存在
if kill -0 $APP_PID 2>/dev/null; then
    echo "应用启动成功，正在运行"
    # 停止应用
    kill $APP_PID 2>/dev/null
    # 等待进程结束
    wait $APP_PID 2>/dev/null
    exit 0
else
    echo "应用启动失败或已闪退"
    exit 1
fi
EOF

chmod +x test_app.sh

if ./test_app.sh "$EXE_PATH"; then
    echo -e "${GREEN}✅ 应用启动测试成功${NC}"
    TEST_RESULT="成功"
else
    echo -e "${RED}❌ 应用启动测试失败${NC}"
    TEST_RESULT="失败"
fi

rm -f test_app.sh

# 9. 生成诊断报告
echo -e "\n${YELLOW}9. 生成诊断报告...${NC}"
REPORT_FILE="diagnostic_report_$(date +%Y%m%d_%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
=== Wails应用诊断报告 ===
生成时间: $(date)
项目目录: $PROJECT_DIR

=== 环境信息 ===
Wails版本: $WAILS_VERSION
macOS版本: $(sw_vers -productVersion)
Go版本: $(go version)
Node版本: $(node --version 2>/dev/null || echo "未安装")

=== 构建信息 ===
应用路径: $APP_PATH
可执行文件: $EXE_PATH
应用包大小: $(du -sh "$APP_PATH" 2>/dev/null | cut -f1 || echo "未知")

=== 签名信息 ===
$(codesign -dv "$APP_PATH" 2>&1 || echo "签名检查失败")

=== 启动测试 ===
测试结果: $TEST_RESULT

=== 建议 ===
EOF

if [ "$TEST_RESULT" = "成功" ]; then
    cat >> "$REPORT_FILE" << EOF
✅ 应用已修复，可以正常启动
- 如果仍有问题，请检查系统权限设置
- 建议在不同环境下测试应用
EOF
else
    cat >> "$REPORT_FILE" << EOF
❌ 应用仍有问题，建议进一步检查：
1. 检查应用依赖的动态库
2. 查看系统控制台日志
3. 检查应用权限设置
4. 尝试在其他macOS设备上测试
EOF
fi

echo -e "${GREEN}✅ 诊断报告已生成: $REPORT_FILE${NC}"

# 10. 总结
echo -e "\n${BLUE}=== 修复完成 ===${NC}"
if [ "$TEST_RESULT" = "成功" ]; then
    echo -e "${GREEN}🎉 应用闪退问题已修复！${NC}"
    echo -e "${GREEN}📱 可以通过以下方式启动应用:${NC}"
    echo -e "   1. 双击应用图标: $APP_PATH"
    echo -e "   2. 命令行启动: open \"$APP_PATH\""
    echo -e "   3. 直接运行: \"$EXE_PATH\""
else
    echo -e "${RED}⚠️  应用问题未完全解决，请查看诊断报告获取更多信息${NC}"
fi

echo -e "\n${BLUE}📋 详细信息请查看: $REPORT_FILE${NC}"
echo -e "${BLUE}🔧 如需进一步帮助，请提供诊断报告内容${NC}"