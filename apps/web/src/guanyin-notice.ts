export function useGuanyinNotice(_g: any, _userId?: string, _connected = true) {
  return {
    visible: false,
    unread: false,
    open: () => {},
    close: () => {},
    allowAutomatic: () => {},
  };
}
