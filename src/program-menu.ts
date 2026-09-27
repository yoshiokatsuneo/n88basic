interface ProgramMenuOptions {
  submit(command: string): Promise<unknown>;
  readPrograms(): Record<string, string>;
  isRunning(): boolean;
  onLoaded(): void;
  onClose(): void;
  download(): void;
  importFile(): void;
}

/** Full-screen access to the same named programs used by SAVE / LOAD. */
export function setupProgramMenu(options: ProgramMenuOptions): void {
  const dialog = document.getElementById("programDialog") as HTMLDialogElement;
  const title = document.getElementById("programDialogTitle") as HTMLElement;
  const form = document.getElementById("programForm") as HTMLFormElement;
  const name = document.getElementById("programName") as HTMLInputElement;
  const list = document.getElementById("programList") as HTMLSelectElement;
  const message = document.getElementById("programNotice") as HTMLElement;
  const submit = document.getElementById("programSubmit") as HTMLButtonElement;
  let mode: "save" | "load" = "save";
  let busy = false;

  function open(nextMode: typeof mode): void {
    if (options.isRunning()) {
      return;
    }
    mode = nextMode;
    title.textContent =
      mode === "save" ? "プログラムを保存" : "プログラムを読み込み";
    name.hidden = mode !== "save";
    name.required = mode === "save";
    list.hidden = mode !== "load";
    submit.textContent = mode === "save" ? "保存する" : "読み込む";
    message.textContent = "";
    submit.disabled = false;
    try {
      const names = Object.keys(options.readPrograms()).sort();
      list.replaceChildren(
        ...names.map((value) => {
          const option = document.createElement("option");
          option.value = option.textContent = value;
          return option;
        }),
      );
      if (mode === "load" && names.length === 0) {
        message.textContent =
          "保存済みのプログラムはありません。ファイルからも読み込めます。";
        submit.disabled = true;
      }
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : String(error);
      submit.disabled = true;
    }
    dialog.showModal();
    if (mode === "save") {
      name.focus();
    } else {
      list.focus();
    }
  }

  document
    .getElementById("screenSave")!
    .addEventListener("click", () => open("save"));
  document
    .getElementById("screenLoad")!
    .addEventListener("click", () => open("load"));
  document
    .getElementById("programCancel")!
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => options.onClose());
  document
    .getElementById("programDownload")!
    .addEventListener("click", () => options.download());
  document.getElementById("programImport")!.addEventListener("click", () => {
    dialog.close();
    options.importFile();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void performSubmit();
  });

  async function performSubmit(): Promise<void> {
    if (busy || options.isRunning()) {
      return;
    }
    const selected = mode === "save" ? name.value.trim() : list.value;
    if (!selected || /["\r\n]/.test(selected)) {
      message.textContent =
        "名前を入力してください（引用符と改行は使えません）。";
      return;
    }
    try {
      if (
        mode === "save" &&
        Object.hasOwn(options.readPrograms(), selected) &&
        !confirm(`「${selected}」を上書きしますか？`)
      ) {
        return;
      }
      if (
        mode === "load" &&
        !confirm("現在のプログラムを置き換えます。読み込みますか？")
      ) {
        return;
      }
      busy = true;
      submit.disabled = true;
      await options.submit(
        `${mode === "save" ? "SAVE" : "LOAD"} "${selected}"`,
      );
      if (mode === "load") {
        options.onLoaded();
      }
      message.textContent = `「${selected}」を${mode === "save" ? "保存" : "読み込み"}しました。`;
      // Keep completion visible; closing returns focus to the BASIC prompt.
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      submit.disabled = false;
    }
  }
}
