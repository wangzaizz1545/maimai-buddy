/**
 * McBuddy AI 全站共享类型。
 *
 * 数据流：questions → answers → vector → persona → profile
 */

/** 六个麦门人格维度 */
export type DimensionKey =
  | "happiness_need"
  | "spending"
  | "taste"
  | "adventure"
  | "social"
  | "recovery";

/** 六维向量，每一维取值 0–1 */
export type PersonaVector = Record<DimensionKey, number>;

/** 维度元信息，用于雷达图与解释文案 */
export type DimensionMeta = {
  key: DimensionKey;
  label: string;
  short: string;
};

/** 题目选项 */
export type QuestionOption = {
  id: string;
  emoji: string;
  label: string;
  /** 该选项对其所属题目维度的取值（0–1） */
  value: number;
  /** 对相邻维度的次级影响，按溢出权重融合，让画像更有层次 */
  spillover?: Partial<PersonaVector>;
  /** 附加标签，如 scene / budget，用于档案页展示 */
  tags?: Record<string, string>;
};

/** 一道题 */
export type Question = {
  id: string;
  dimension: DimensionKey;
  title: string;
  subtitle?: string;
  /** 选项网格列数（移动端始终单列） */
  columns: 2 | 3;
  options: QuestionOption[];
};

/** 作答结果：questionId -> optionId */
export type Answers = Record<string, string>;

/** 人格专属渐变 */
export type PersonaGradient = {
  from: string;
  to: string;
  accent: string;
};

/** 人格原型 */
export type Persona = {
  code: string;
  emoji: string;
  name: string;
  /** 一句话画像（结果页副标题） */
  tagline: string;
  /** 2–3 句描述（截图核心文案） */
  description: string;
  /** 3 条特点 */
  traits: string[];
  /** 推荐理由 */
  reasons: string;
  /** 推荐场景 */
  scenes: string[];
  /** 六维原型向量，用于匹配 */
  vector: PersonaVector;
  gradient: PersonaGradient;
  /** 分享文案模板 */
  shareText: string;
};

/** 匹配结果（持久化到 localStorage） */
export type PersonaResult = {
  code: string;
  name: string;
  emoji: string;
  vector: PersonaVector;
  /** 置信度 60–99 */
  confidence: number;
  /** 混合型：与第二人格差距极小时出现 */
  secondaryCode?: string;
  createdAt: string;
};

/** 「AI 记得你的 N 件事」 */
export type MemoryItem = {
  id: string;
  icon: string;
  text: string;
};

/** 麦友档案展示数据 */
export type BuddyProfile = {
  nickname: string;
  personaCode: string;
  /** 口味偏好与强度（1–5） */
  taste: { label: string; level: number };
  budget: string;
  scene: string;
  memories: MemoryItem[];
};

/** 作答推导出的可读上下文 */
export type AnswerContext = {
  budget: string;
  scene: string;
  mood: string;
};
