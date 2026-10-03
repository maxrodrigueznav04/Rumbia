export function canUseVisualTemplates(user) {
  return Boolean((import.meta.env.DEV || import.meta.env.VITE_ENABLE_VISUAL_TEMPLATES === 'true')
    && user?.features?.visualTemplates);
}
