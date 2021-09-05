import Runner from './runner';

export default class App {
  private $runnerMount = document.querySelector('#runner') as HTMLElement;

  private runner: Runner | undefined;

  constructor() {
    this.run();
  }

  onRunnerComplete = (showMessage = true): void => {
    this.runner = undefined;

    if (showMessage) {
      this.$runnerMount.innerHTML = `
      ${this.$runnerMount.innerHTML}
      <div class="fixed-message">
        <code>Session complete</code>
      </div>
      `;
    }
  };

  run = async (): Promise<void> => {
    if (this.runner) {
      this.runner.close(false);
    }
    const $mount = this.$runnerMount;
    const onClose = this.onRunnerComplete;

    this.runner = new Runner({ $mount, onClose });
  };
}
