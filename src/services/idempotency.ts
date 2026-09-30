export function createCaptureOperationKey() {
  const timestamp = Date.now().toString(36);
  const random = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
  return `capture_${timestamp}_${random}`.slice(0, 100);
}
