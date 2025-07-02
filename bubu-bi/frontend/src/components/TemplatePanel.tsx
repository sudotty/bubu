import React from 'react';
import { UI_CONSTANTS, STYLE_CLASSES } from '../constants/ui';

interface Template {
  id: number;
  title: string;
  description: string;
  prompt_text: string;
  usage_count: number;
  last_used_at: string;
}

interface TemplatePanelProps {
  templates: Template[];
  showTemplates: boolean;
  onClose: () => void;
  onUseTemplate: (templateId: number, promptText: string) => void;
  onDeleteTemplate: (templateId: number) => void;
}

export const TemplatePanel: React.FC<TemplatePanelProps> = ({
  templates,
  showTemplates,
  onClose,
  onUseTemplate,
  onDeleteTemplate
}) => {
  if (!showTemplates) return null;

  return (
    <div className="border-t border-base-300 bg-base-50 p-4">
      <div className={STYLE_CLASSES.FLEX_BETWEEN + " mb-4"}>
        <h3 className="text-fluid-lg font-semibold">
          {UI_CONSTANTS.TEMPLATES.BUTTON_ICON} 智能建议
        </h3>
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm"
          title="关闭智能建议面板"
        >
          {UI_CONSTANTS.ICONS.CLOSE}
        </button>
      </div>
      
      {(!templates || templates.length === 0) ? (
        <TemplateEmptyState />
      ) : (
        <TemplateList 
          templates={templates}
          onUseTemplate={onUseTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      )}
    </div>
  );
};

// 空状态组件
const TemplateEmptyState: React.FC = () => (
  <div className="text-center py-8 text-base-content/60">
    <div className="text-4xl mb-2">{UI_CONSTANTS.TEMPLATES.EMPTY_STATE_ICON}</div>
    <p>暂无智能建议</p>
    <p className={STYLE_CLASSES.TEXT_SMALL}>
      保存常用查询作为智能建议，方便快速使用
    </p>
  </div>
);

// 模板列表组件
interface TemplateListProps {
  templates: Template[];
  onUseTemplate: (templateId: number, promptText: string) => void;
  onDeleteTemplate: (templateId: number) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  onUseTemplate,
  onDeleteTemplate
}) => (
  <div className="grid gap-3 overflow-y-auto" style={{ maxHeight: UI_CONSTANTS.TEMPLATES.MAX_DISPLAY_HEIGHT }}>
    {templates.map((template) => (
      <TemplateCard
        key={template.id}
        template={template}
        onUse={() => onUseTemplate(template.id, template.prompt_text)}
        onDelete={() => onDeleteTemplate(template.id)}
      />
    ))}
  </div>
);

// 模板卡片组件
interface TemplateCardProps {
  template: Template;
  onUse: () => void;
  onDelete: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onUse,
  onDelete
}) => (
  <div className={STYLE_CLASSES.CARD_BASE + " p-3"}>
    <div className={STYLE_CLASSES.FLEX_BETWEEN}>
      <div className="flex-1">
        <h4 className="font-medium text-fluid-sm">{template.title}</h4>
        <p className={`${STYLE_CLASSES.TEXT_XS} ${STYLE_CLASSES.TEXT_MUTED} mt-1`}>
          {template.description}
        </p>
        <div className={`flex items-center ${STYLE_CLASSES.SPACE_X_2} mt-2 ${STYLE_CLASSES.TEXT_XS} text-base-content/50`}>
          <span>使用次数: {template.usage_count}</span>
          <span>最后使用: {new Date(template.last_used_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div className={`flex ${STYLE_CLASSES.SPACE_X_2} ml-2`}>
        <button
          onClick={onUse}
          className={`${STYLE_CLASSES.BTN_GHOST} ${STYLE_CLASSES.BTN_XS}`}
          title="使用智能建议"
        >
          {UI_CONSTANTS.ICONS.COPY}
        </button>
        <button
          onClick={onDelete}
          className={`${STYLE_CLASSES.BTN_GHOST} ${STYLE_CLASSES.BTN_XS} text-error`}
          title="删除智能建议"
        >
          {UI_CONSTANTS.ICONS.DELETE}
        </button>
      </div>
    </div>
  </div>
);

export default TemplatePanel;