import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function B92PlaceholderModalContent(props: Props) {
  return (
    <div className="b92-placeholder-callout">
      {props.children}
    </div>
  );
}
