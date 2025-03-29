export const systemTagHandlers: {
    [key: string]: (value: string) => any;
  } = {
    order: (value: string) => {
      const allowed = ["score", "new", "random"];
      return allowed.includes(value) ? value : "score";
    },
    limit: (value: string) => {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? 50 : Math.min(Math.max(parsed, 1), 100);
    },
  };