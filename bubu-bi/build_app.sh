#!/bin/bash

# Wails应用优化构建脚本
# 解决macOS应用闪退和签名问题

set -e

echo "🚀 开始构建Wails应用..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 清理构建缓存
echo -e "${YELLOW}1. 清理构建缓存...${NC}"
if [ -d "build/bin" ]; then
    rm -rf build/bin
fi
echo -e "${GREEN}✅ 构建缓存已清理${NC}"

# 2. 更新依赖
echo -e "\n${YELLOW}2. 更新依赖...${NC}"
go mod tidy
cd frontend && npm install && cd ..
echo -e "${GREEN}✅ 依赖更新完成${NC}"

# 3. 优化构建
echo -e "\n${YELLOW}3. 开始构建应用...${NC}"
echo -e "${BLUE}使用优化参数: -clean -trimpath -ldflags='-s -w'${NC}"

# 构建命令，添加优化参数
wails build \
    -clean \
    -trimpath \
    -ldflags="-s -w" \
    -v 1

echo -e "${GREEN}✅ 应用构建完成${NC}"

# 4. 自动修复签名
echo -e "\n${YELLOW}4. 修复应用签名...${NC}"
APP_PATH="./build/bin/bubu.app"
if [ -d "$APP_PATH" ]; then
    codesign --force --deep --sign - "$APP_PATH" 2>/dev/null
    echo -e "${GREEN}✅ 应用签名已修复${NC}"
else
    echo -e "${RED}❌ 应用包不存在${NC}"
    exit 1
fi

# 5. 验证构建结果
echo -e "\n${YELLOW}5. 验证构建结果...${NC}"
APP_SIZE=$(du -sh "$APP_PATH" | cut -f1)
echo -e "${BLUE}应用大小: $APP_SIZE${NC}"
echo -e "${BLUE}应用路径: $(pwd)/$APP_PATH${NC}"

# 6. 提供启动方式
echo -e "\n${GREEN}🎉 构建成功！${NC}"
echo -e "${BLUE}启动方式:${NC}"
echo -e "  1. 双击应用: $APP_PATH"
echo -e "  2. 命令行: open \"$APP_PATH\""
echo -e "  3. 直接运行: \"$APP_PATH/Contents/MacOS/bubu\""

echo -e "\n${YELLOW}💡 提示:${NC}"
echo -e "  - 如果首次运行被阻止，请在系统偏好设置中允许"
echo -e "  - 应用已使用adhoc签名，适合开发和测试使用"
echo -e "  - 生产环境建议使用开发者证书签名"