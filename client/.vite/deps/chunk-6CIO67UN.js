import {
  require_react
} from "./chunk-4JZFVNKQ.js";
import {
  __toESM
} from "./chunk-PX6F3LHL.js";

// node_modules/.pnpm/@radix-ui+react-use-callback-ref@1.1.2_@types+react@19.2.17_react@19.2.7/node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
var React = __toESM(require_react(), 1);
function useCallbackRef(callback) {
  const callbackRef = React.useRef(callback);
  React.useEffect(() => {
    callbackRef.current = callback;
  });
  return React.useMemo(() => ((...args) => callbackRef.current?.(...args)), []);
}

export {
  useCallbackRef
};
//# sourceMappingURL=chunk-6CIO67UN.js.map
