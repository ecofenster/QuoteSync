import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function B92ModalFrame(props: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="Close B92 configurator modal"
        onClick={props.onClose}
        className="b92-modal__backdrop"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className="b92-modal__dialog"
      >
        <header className="b92-modal__header">
          <h3 className="b92-modal__title">{props.title}</h3>
          <button type="button" className="b92-secondary-button" onClick={props.onClose}>
            Done
          </button>
        </header>
        {props.children}
      </section>
    </>
  );
}
