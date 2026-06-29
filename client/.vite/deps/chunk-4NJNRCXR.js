import {
  require_react
} from "./chunk-4JZFVNKQ.js";
import {
  __toESM
} from "./chunk-PX6F3LHL.js";

// node_modules/.pnpm/@radix-ui+react-use-previous@1.1.2_@types+react@19.2.17_react@19.2.7/node_modules/@radix-ui/react-use-previous/dist/index.mjs
var React = __toESM(require_react(), 1);
function usePrevious(value) {
  const ref = React.useRef({ value, previous: value });
  return React.useMemo(() => {
    if (ref.current.value !== value) {
      ref.current.previous = ref.current.value;
      ref.current.value = value;
    }
    return ref.current.previous;
  }, [value]);
}

export {
  usePrevious
};
//# sourceMappingURL=chunk-4NJNRCXR.js.map
