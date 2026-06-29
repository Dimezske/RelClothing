"use client";
import {
  Primitive
} from "./chunk-G3K2ZKRM.js";
import "./chunk-45AIXEBY.js";
import "./chunk-PCTGX3P2.js";
import {
  require_jsx_runtime
} from "./chunk-5GC6IAOP.js";
import {
  require_react
} from "./chunk-4JZFVNKQ.js";
import {
  __toESM
} from "./chunk-PX6F3LHL.js";

// node_modules/.pnpm/@radix-ui+react-label@2.1.10_@types+react-dom@19.2.3_@types+react@19.2.17__@types+react_007bc5785938acc144f10abac23fbe91/node_modules/@radix-ui/react-label/dist/index.mjs
var React = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var NAME = "Label";
var Label = React.forwardRef((props, forwardedRef) => {
  return (0, import_jsx_runtime.jsx)(
    Primitive.label,
    {
      ...props,
      ref: forwardedRef,
      onMouseDown: (event) => {
        const target = event.target;
        if (target.closest("button, input, select, textarea")) return;
        props.onMouseDown?.(event);
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
      }
    }
  );
});
Label.displayName = NAME;
var Root = Label;
export {
  Label,
  Root
};
//# sourceMappingURL=@radix-ui_react-label.js.map
