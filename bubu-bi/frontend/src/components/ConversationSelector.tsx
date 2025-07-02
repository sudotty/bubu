import React, { useState, useEffect } from 'react';
import { GetConversationsByFiles, CreateConversation, GetConversationMessages } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

interface ConversationSelectorProps {
  fileKey: string;
  fileName: string;
  selectedFiles?: any[];
  onSelectConversation: (conversationId: number, messages: main.ConversationMessage[]) => void;
  onCreateNewConversation: (conversationId: number) => void;
}

interface ConversationListItem {
  id: number;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export const ConversationSelector: React.FC<ConversationSelectorProps> = ({
  fileKey,
  fileName,
  selectedFiles = [],
  onSelectConversation,
  onCreateNewConversation,
}) => {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 生成会话ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 加载会话列表
  const loadConversations = async () => {
    if (!fileKey) return;
    
    setLoading(true);
    try {
      const fileKeys = selectedFiles.length > 0 
        ? selectedFiles.map(f => f.filename)
        : [fileKey];
      const result = await GetConversationsByFiles(fileKeys);
      
      // 按时间倒序排列，最新的在最上面
      const sortedConversations = result.sort((a: any, b: any) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setConversations(sortedConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      alert('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建新会话
  const handleCreateNewConversation = async () => {
    setLoading(true);
    try {
      const sessionId = generateSessionId();
      const title = selectedFiles.length > 1 
        ? `多文件会话 - ${new Date().toLocaleString()}`
        : `新会话 - ${fileName} - ${new Date().toLocaleString()}`;
      
      const primaryFileKey = selectedFiles.length > 0 ? selectedFiles[0].filename : fileKey;
      const conversation = await CreateConversation(sessionId, primaryFileKey, title);
      
      onCreateNewConversation(conversation.id);
      
      // 刷新会话列表
      await loadConversations();
    } catch (error) {
      console.error('Failed to create conversation:', error);
      alert('创建新会话失败');
    } finally {
      setLoading(false);
    }
  };

  // 选择历史会话
  const handleSelectConversation = async (conversationId: number) => {
    setLoading(true);
    try {
      const messages = await GetConversationMessages(conversationId);
      onSelectConversation(conversationId, messages);
      alert('会话加载成功');
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
      alert('加载会话消息失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleString('zh-CN');
  };

  // 组件挂载时加载会话列表
  useEffect(() => {
    loadConversations();
  }, [fileKey]);

  return (
    <div className="flex items-center justify-center h-full bg-base-100 p-6">
      <div className="w-full max-w-4xl bg-base-100 rounded-2xl shadow-xl overflow-hidden card">
        {/* 头部区域 */}
        <div className="bg-primary text-primary-content p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                💬 会话管理
              </h2>
              <p className="text-primary-content/80 text-lg">
                {selectedFiles.length > 1 
                  ? `已选择 ${selectedFiles.length} 个文件`
                  : `当前文件: ${fileName}`
                }
              </p>
            </div>
            <div className="text-6xl opacity-20">
              {selectedFiles.length > 1 ? '📊' : '📄'}
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* 文件列表展示 */}
          {selectedFiles.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-base-content mb-4 flex items-center">
                <span className="mr-2">📁</span>
                选中的文件
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="bg-base-200 rounded-lg p-3 border border-base-300">
                    <div className="text-sm font-medium text-base-content truncate">
                      {file.filename}
                    </div>
                    <div className="text-xs text-base-content/60 mt-1">
                      {file.file_path}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 新建会话区域 */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-base-content flex items-center">
                <span className="mr-2">✨</span>
                开始新会话
              </h3>
              <div className="bg-base-200 rounded-xl p-6 border border-base-300 card">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🚀</div>
                  <p className="text-base-content/70">
                    创建新的会话开始数据分析之旅
                  </p>
                </div>
                <button
                  onClick={handleCreateNewConversation}
                  disabled={loading}
                  className="btn btn-primary w-full font-semibold py-4 px-6 transition-all duration-200 transform hover:scale-105 disabled:scale-100"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <span className="loading loading-spinner loading-sm mr-2"></span>
                      创建中...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span className="mr-2 text-xl">➕</span>
                      创建新会话
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* 历史会话区域 */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-base-content flex items-center">
                <span className="mr-2">🕒</span>
                历史会话
              </h3>
              
              <div className="bg-base-200 rounded-xl p-6 border border-base-300 max-h-96 overflow-y-auto card">
                {loading ? (
                  <div className="text-center py-8">
                    <span className="loading loading-spinner loading-lg mb-4"></span>
                    <div className="text-base-content/60">加载中...</div>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4 opacity-50">📭</div>
                    <div className="text-base-content/60 text-lg">暂无历史会话</div>
                    <div className="text-base-content/40 text-sm mt-2">创建第一个会话开始使用</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className="bg-base-100 border border-base-300 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-primary card"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-base-content mb-2 truncate">
                              {conversation.title}
                            </h4>
                            <div className="text-sm text-base-content/60 space-y-1">
                              <div className="flex items-center">
                                <span className="mr-1">📅</span>
                                创建: {formatTime(conversation.created_at)}
                              </div>
                              <div className="flex items-center">
                                <span className="mr-1">🔄</span>
                                更新: {formatTime(conversation.updated_at)}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectConversation(conversation.id)}
                            disabled={loading}
                            className="btn btn-success ml-4 transition-all duration-200 transform hover:scale-105 disabled:scale-100 flex items-center whitespace-nowrap"
                          >
                            <span className="mr-1">💬</span>
                            进入
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationSelector;