import React from "react";

type Props = {
  expanded: boolean;
};

export default function ExpandToggle(props: Props) {
  const { expanded } = props;

  return (
    <div
      aria-hidden="true" className="qs-migrated-117"
    >
      {expanded ? "▲" : "▼"}
    </div>
  );
}
