import Runner from './runner';

export default class App {
  private $runnerMount = document.querySelector('#runner') as HTMLElement;

  private runner: Runner | undefined;

  constructor() {
    this.run();
  }

  onRunnerComplete = (showMessage = true) => {
    this.runner = undefined;

    if (showMessage) {
      this.$runnerMount.innerHTML = `
      ${this.$runnerMount.innerHTML}
      <div class="fixed-message">
        <code>Session complete. Click ► to run your code again.</code>
      </div>
      `;
    }
  };

  run = async () => {
    if (this.runner) {
      this.runner.close(false);
    }
    const $mount = this.$runnerMount;
    const onClose = this.onRunnerComplete;

    this.runner = new Runner({ $mount, onClose });
  };
}
