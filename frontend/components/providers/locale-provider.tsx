'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'en' | 'zh-CN';

type Interpolation = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (message: string, values?: Interpolation) => string;
};

const LOCALE_STORAGE_KEY = 'imagefwx-locale';

// English source strings are the stable keys. Keeping the catalog local avoids
// a runtime dependency and lets individual UI areas migrate without changing
// ImageMagick operation IDs or API contracts.
const zhCN: Record<string, string> = {
  'Upload': '上传', 'NAS': 'NAS 相册', 'Photo source': '照片来源',
  'Open on desktop for full editing experience': '请在桌面端打开以使用完整编辑功能',
  'Light': '浅色', 'Dark': '深色', 'System': '跟随系统',
  'Language': '语言', 'English': 'English', '中文': '中文',
  '{count} selected': '已选择 {count} 张', 'Clear': '清除',
  'Projects': '项目', 'All Images': '全部图片', 'View all uploaded images': '查看所有已上传图片',
  'Log in to create projects and organize your images': '登录后可创建项目并整理图片',
  'No projects yet': '暂无项目', 'Create Project': '创建项目',
  'Project name': '项目名称', 'Project color': '项目颜色', 'Create': '创建', 'Cancel': '取消',
  'Edit Project': '编辑项目', 'Save': '保存', 'Delete': '删除', 'History': '历史记录', 'Settings': '设置',
  'Please enter a project name': '请输入项目名称', 'Project created!': '项目已创建！',
  'Project updated!': '项目已更新！', 'Project deleted': '项目已删除',
  'Failed to create project': '创建项目失败', 'Failed to update project': '更新项目失败',
  'Failed to delete project': '删除项目失败', 'Delete this project? Images will not be deleted.': '删除此项目？图片不会被删除。',
  '{count} image': '{count} 张图片', '{count} images': '{count} 张图片',
  'Uploading...': '正在上传…', 'Invalid file type': '不支持的文件类型', 'Drop files here': '将文件拖放到这里',
  'Drop images here or click to browse': '将图片拖放到这里，或点击选择文件',
  'Supports JPG, PNG, WebP, GIF, SVG, TIFF, PDF, and more': '支持 JPG、PNG、WebP、GIF、SVG、TIFF、PDF 等格式',
  'Uploaded {count} image(s)': '已上传 {count} 张图片', 'Failed to upload {count} file(s)': '{count} 个文件上传失败',
  'Upload failed': '上传失败', 'NAS photos': 'NAS 照片',
  'Original files stay read-only; imports are copied into the library.': '原始文件保持只读；导入时会复制到图片库。',
  'Up': '上一级', 'Select all': '全选', 'Import selected ({count})': '导入所选（{count}）',
  'No supported images in this folder.': '此文件夹中没有受支持的图片。',
  'Unable to browse NAS': '无法浏览 NAS', 'NAS import failed': 'NAS 导入失败',
  'Imported {count} photo(s)': '已导入 {count} 张照片', '{count} file(s) were not imported': '{count} 个文件未能导入',
  'Unable to copy the file into application storage': '无法将文件复制到应用存储目录',
  'Unable to add the imported file to the image library': '无法将导入文件加入图片库',
  'Settings saved!': '设置已保存！', 'Failed to save settings': '保存设置失败',
  'Settings reset to defaults': '设置已恢复默认值', 'Failed to reset settings': '恢复默认设置失败',
  'Account': '账号', 'Logged in as': '当前登录账号', 'Change Password': '修改密码',
  'Create New Account': '创建新账号', 'Add a new user (admin only)': '添加新用户（仅管理员）',
  'Create Account': '创建账号', 'Log in to manage your account': '登录后可管理账号',
  'Log In': '登录', 'Register': '注册', 'Security': '安全', 'Require Login': '要求登录',
  'Users must log in to use the application': '用户必须登录后才能使用应用',
  'Appearance': '外观', 'Theme': '主题', 'Image Processing': '图片处理',
  'Default Format': '默认格式', 'Default Quality': '默认质量', 'Maximum Upload Size': '最大上传大小',
  'Save Settings': '保存设置', 'Reset to Defaults': '恢复默认值',
  'Disabled': '已关闭', 'Choose your preferred theme': '选择偏好的主题',
  'Processing Defaults': '处理默认值', 'Default Output Format': '默认输出格式',
  'Max Parallel Jobs': '最大并行任务数', 'Upload Settings': '上传设置', 'Max Upload Size': '最大上传大小',
  'History Retention': '历史记录保留期', 'Behavior': '行为设置', 'Auto-download results': '自动下载结果',
  'Automatically download processed files': '自动下载处理完成的文件',
  'Delete originals after processing': '处理后删除原文件', 'Remove source files after successful processing': '处理成功后删除源文件',
  'Sign in to your account': '登录你的账号', 'Email': '邮箱', 'Password': '密码',
  'Enter your password': '输入密码', 'Sign in': '登录', 'Or continue with': '或使用以下方式继续',
  'Sign in with Google': '使用 Google 登录', 'Don\'t have an account?': '还没有账号？',
  'Create one': '创建账号', 'Continue as guest': '以访客身份继续',
  'Please fill in all fields': '请填写所有字段', 'Welcome back!': '欢迎回来！',
  'Login failed': '登录失败', 'Invalid credentials': '邮箱或密码错误',
  'Sign In': '登录', 'Welcome back': '欢迎回来', 'Create account': '创建账号',
  'Sign in to save your settings and history': '登录以保存设置和处理历史',
  'Create an account to get started': '创建账号以开始使用', 'Name': '姓名', 'Your name': '你的姓名',
  'Confirm Password': '确认密码', 'Password requirements:': '密码要求：',
  'At least 8 characters': '至少 8 个字符', 'One lowercase letter': '一个小写字母',
  'One uppercase letter': '一个大写字母', 'One digit': '一个数字',
  'One special character (!@#$%^&*...)': '一个特殊字符（!@#$%^&*...）',
  'Passwords do not match': '两次输入的密码不一致', 'Loading...': '正在加载…',
  'Or': '或', 'Redirecting...': '正在跳转…', 'Continue with Google': '使用 Google 继续',
  'Already have an account?': '已有账号？', 'Sign Up': '注册',
  'Don\'t have an account? Sign up': '还没有账号？立即注册',
  'Already have an account? Sign in': '已有账号？立即登录',
  'Registration is disabled': '注册功能已关闭',
  'Registration is currently disabled. Contact administrator.': '当前已关闭注册，请联系管理员。',
  'Password does not meet requirements': '密码不符合要求', 'Account created successfully!': '账号创建成功！',
  'Authentication failed': '身份验证失败', 'Logged out successfully': '已退出登录',
  'Google login failed': 'Google 登录失败', 'Failed to initiate Google login': '无法发起 Google 登录',
  'Back to home': '返回首页', 'Signing in...': '正在登录…',
  'Redirecting to Google...': '正在跳转到 Google…', 'Login is required to use this application': '使用此应用需要登录',
  'You can also use the app without an account.': '你也可以不登录直接使用此应用。',
  'Please fill in all required fields': '请填写所有必填字段', 'Password does not meet all requirements': '密码未满足全部要求',
  'Registration failed': '注册失败', 'Please try again': '请稍后重试',
  'Registration disabled': '注册功能已关闭', 'New account registration is currently turned off. Please contact the administrator if you need access.': '当前已关闭新账号注册。如需访问权限，请联系管理员。',
  'Back to sign in': '返回登录', 'Create your account': '创建你的账号',
  'Important notice': '重要提示',
  'Images uploaded without an account are NOT private — on a server with open access they are visible to every other anonymous visitor. Create an account to keep your images tied to you. After registering you start with a clean gallery; images you uploaded anonymously stay in the shared anonymous pool.': '未登录上传的图片并非私有：在开放访问的服务器上，其他匿名访问者也能看到它们。创建账号可将之后的图片关联到你的账号；注册后会从一个空白图库开始，匿名上传的图片仍留在共享匿名图库中。',
  'Name (optional)': '姓名（可选）', 'Email *': '邮箱 *', 'Password *': '密码 *',
  'Create a password': '创建密码', 'Confirm Password *': '确认密码 *', 'Confirm your password': '确认密码',
  'Creating account...': '正在创建账号…',
  'Quick Operations': '快速操作', 'Select images to process': '选择图片后进行处理',
  'Resize': '缩放', 'Rotate': '旋转', 'Text': '文字', 'Terminal': '终端',
  'Dimensions': '尺寸', 'Percentage': '百分比', 'Width': '宽度', 'Height': '高度',
  'Fit Mode': '适配模式', 'Quick Presets': '快捷预设', 'Scale: {count}%': '缩放：{count}%',
  'Rotation: {count}°': '旋转：{count}°', 'Flip': '翻转', 'Horizontal': '水平', 'Vertical': '垂直',
  'Fit (within bounds)': '适配（保持在边界内）', 'Fill (cover bounds)': '填充（覆盖边界）',
  'Force (exact size)': '强制（精确尺寸）', 'Square': '正方形', 'Full HD': '全高清',
  'Position': '位置', 'Font Size: {count}pt': '字号：{count}pt', 'Output Format': '输出格式',
  'Quality: {count}%': '质量：{count}%', 'Command Preview': '命令预览',
  'Apply to {count} image(s)': '应用到 {count} 张图片', 'Processing...': '正在处理…',
  'Enter watermark text...': '输入水印文字…', 'ImageMagick Terminal': 'ImageMagick 终端',
  'Use %input% for input file': '使用 %input% 代表输入文件', 'Use %output% for output file': '使用 %output% 代表输出文件',
  'Some commands are blocked for security': '为安全起见，部分命令已被禁用', 'Quick Commands': '快捷命令',
  'Grayscale': '灰度', 'Sepia': '棕褐色', 'Negate': '反相', 'Auto-enhance': '自动增强',
  'WebP (recommended)': 'WebP（推荐）',
  'Enter a command first': '请先输入命令', 'Job queued': '任务已加入队列',
  'Processed {count} image(s)': '已处理 {count} 张图片', '{count} failed': '{count} 张失败',
  'All operations failed': '所有操作均失败', 'Rotated {count} image(s) by {angle}°': '已将 {count} 张图片旋转 {angle}°',
  'Rotation failed': '旋转失败', 'Flipped {count} image(s) {direction}': '已翻转 {count} 张图片（{direction}）',
  'Flip failed': '翻转失败', 'horizontal': '水平', 'vertical': '垂直',
  'Error building command': '构建命令时出错',
  'Edit': '编辑', 'Info': '信息', 'Download': '下载', 'Download selected': '下载所选',
  'Delete selected': '删除所选', 'No images yet': '暂无图片',
  'Upload images to start editing': '上传图片后开始编辑', 'Image deleted': '图片已删除',
  'Failed to delete image': '删除图片失败', 'Download started': '已开始下载',
  'Failed to download images': '下载图片失败',
  'Select All': '全选', 'Add to Project': '加入项目', 'Remove': '移除',
  'No images in this project': '此项目中没有图片', 'Select images from "All Images" and add them to this project': '请从“全部图片”中选择图片并加入此项目',
  'Added {count} image(s) to project': '已将 {count} 张图片加入项目', 'Removed {count} image(s) from project': '已从项目中移除 {count} 张图片',
  'Failed to add images to project': '加入项目失败', 'Failed to remove images from project': '从项目中移除失败',
  'Are you sure you want to delete {count} image(s)?': '确定要删除 {count} 张图片吗？',
  'Deleted {count} image(s)': '已删除 {count} 张图片', 'Failed to delete some images': '部分图片删除失败',
  '{count} in project': '项目内 {count} 张', 'Project': '项目',
  'Size': '大小', 'Type': '类型', 'Unknown': '未知', 'Edit Image': '编辑图片',
  'Select a project...': '选择一个项目…', 'Add {count} image(s)': '加入 {count} 张图片',
  'Border': '边框', 'Frame': '相框', 'Reset': '重置', 'Enabled': '启用',
  'Preset': '预设', 'Custom': '自定义', 'Color': '颜色', 'Linked sides': '四边联动',
  'Top': '上', 'Right': '右', 'Bottom': '下', 'Left': '左', 'Target ratio': '目标比例',
  'Alignment': '对齐', 'Center': '居中', 'Save changes': '保存修改', 'Close': '关闭',
  'Enable border': '启用边框', 'Mode': '模式', 'Unit': '单位', 'Link sides': '联动四边',
  'Double': '双层', 'Matte': '留白画布', '% short edge': '短边百分比',
  'Classic White': '经典白边', 'Thin Black': '细黑边', 'Polaroid': '拍立得',
  'Double Gallery': '双层画廊', 'Square Matte': '正方留白', 'Portrait Matte': '竖幅留白',
  'Floating shadow': '悬浮阴影', 'Shadow color': '阴影颜色', 'Blur': '模糊',
  'Opacity': '不透明度', 'Y offset': 'Y 轴偏移', 'Inner border': '内层边框',
  'Canvas ratio': '画布比例', 'Reset border': '重置边框',
  '{count} image(s) selected': '已选择 {count} 张图片', 'No images selected': '未选择图片',
  'No operations to apply': '没有可应用的操作', 'Processing failed': '处理失败',
  'Processing History': '处理历史', 'Refresh': '刷新', 'All': '全部',
  'Pending': '等待中', 'Processing': '处理中', 'Completed': '已完成',
  'Failed': '失败', 'Cancelled': '已取消', 'No processing history': '暂无处理历史',
  'Process some images to see them here': '处理图片后，记录会显示在这里',
  'Go to Editor': '前往编辑器', 'Failed to load history': '加载处理历史失败',
  'Job deleted': '任务已删除', 'Failed to delete job': '删除任务失败',
  'Download started!': '已开始下载！', 'Download failed': '下载失败',
  '{count}% complete': '已完成 {count}%', '{count} input file(s)': '{count} 个输入文件',
  '{count} output file(s)': '{count} 个输出文件', 'Remove Background': '移除背景',
  'AI background removal': 'AI 背景移除', 'Image cropped': '已裁剪图片',
  'Image resized': '已调整图片尺寸', 'Watermark': '水印', 'Text added': '已添加文字',
  'Filter': '滤镜', 'Filters applied': '已应用滤镜', 'Adjustments': '调整',
  'Brightness/contrast/saturation': '亮度 / 对比度 / 饱和度', 'Auto Enhance': '自动增强',
  'Auto enhancement applied': '已应用自动增强', 'Convert': '格式转换',
  'Format: {format}': '格式：{format}', 'Multiple Edits': '多项编辑',
  '{count} edits': '{count} 项编辑',
  'Click to rename': '点击重命名', 'Unsaved': '未保存', 'Crop Mode': '裁剪模式',
  'Adjust': '调整', 'Crop': '裁剪', 'AI': 'AI',
  'Rotate left': '向左旋转', 'Rotate right': '向右旋转', 'Flip H': '水平翻转', 'Flip V': '垂直翻转',
  'Brightness': '亮度', 'Contrast': '对比度', 'Saturation': '饱和度', 'Hue': '色相',
  'Quick Filters': '快速滤镜', 'Resize Image': '调整图片尺寸', 'Change dimensions or scale': '修改尺寸或缩放比例',
  'Width (px)': '宽度（px）', 'Height (px)': '高度（px）', 'Aspect Ratio Locked': '已锁定宽高比',
  'Aspect Ratio Unlocked': '未锁定宽高比', 'Quick Sizes': '常用尺寸', 'Scale': '缩放',
  'Updating ImageMagick preview…': '正在更新 ImageMagick 预览…',
  'Crop Image': '裁剪图片', 'Draw on image to select area': '在图片上拖动以选择区域',
  'Start Cropping': '开始裁剪', 'Exit Crop Mode': '退出裁剪模式', 'Apply Crop': '应用裁剪',
  'Watermark Text': '水印文字', 'Text color': '文字颜色', 'Font Size': '字体大小',
  'Logo / Image': '徽标 / 图片', 'Format': '格式',
  'Unsaved Changes': '未保存的修改', 'You have unsaved changes. What would you like to do?': '你有尚未保存的修改。要如何处理？',
  'Discard': '放弃修改',
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function format(message: string, values?: Interpolation) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    const browserLocale = navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
    setLocaleState(stored === 'en' || stored === 'zh-CN' ? stored : browserLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === 'en' ? 'zh-CN' : 'en'),
    t: (message, values) => format(locale === 'zh-CN' ? (zhCN[message] ?? message) : message, values),
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
