import React from "react";

export function ControlToolbar({ children }: { children: React.ReactNode }) {
  return <div className="ui-control-toolbar">{children}</div>;
}

export function ControlToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ui-control-toolbar__group">
      <div className="ui-control-toolbar__label">{label}</div>
      <div className="ui-control-toolbar__items">{children}</div>
    </div>
  );
}
