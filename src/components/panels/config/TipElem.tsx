import { memo } from "react";

const TipElem = memo(({ content }: { content: string }) => (
  <div style={{ maxWidth: 260 }}>{content}</div>
));

export default TipElem;
