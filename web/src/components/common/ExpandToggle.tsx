import React from "react";

type Props = {
  expanded: boolean;
};

export default function ExpandToggle(props: Props) {
  const { expanded } = props;

  return (
    <div
      aria-hidden="true"
      style={{
        width: 22,
        minWidth: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        fontWeight: 900,
        color: "#18181b",
        lineHeight: 1,
      }}
    >
      {expanded ? "▲" : "▼"}
    </div>
  );
}
