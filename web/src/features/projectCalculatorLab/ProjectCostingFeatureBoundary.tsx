import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey: string };

export default class ProjectCostingFeatureBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Project Costing worksheet could not render", {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  render() {
    if (this.state.failed)
      return (
        <section className="ui-card calculator-lab__card" role="alert">
          <h2>Project Costing is temporarily unavailable</h2>
          <p>
            The worksheet error was contained. Your current Estimate remains open and no costing data was changed.
          </p>
          <button type="button" className="ui-button" onClick={() => this.setState({ failed: false })}>
            Try Project Costing again
          </button>
        </section>
      );
    return this.props.children;
  }
}
