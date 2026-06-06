const jsInstanceId = Math.random().toString(36).slice(2, 8)

console.log('[JS INSTANCE]', jsInstanceId)

export function getJsInstanceId() {
  return jsInstanceId
}
