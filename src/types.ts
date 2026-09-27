/** Values supported by the BASIC interpreter (independent of the browser UI). */
export type BasicValue = number | string;
export interface RunResult {
  stopped: boolean;
}
export interface CommandResult {
  kind:
    | "empty"
    | "edit"
    | "save"
    | "load"
    | "merge"
    | "files"
    | "run"
    | "new"
    | "clear"
    | "list"
    | "direct";
  stopped?: boolean;
  silent?: boolean;
}
export interface BasicIO {
  print?(text: string): void;
  clear?(mode: number): void;
  input?(prompt: string): Promise<string>;
  cancelInput?(): void;
  inkey?(): string;
  keydown?(key: string): boolean;
  color?(color: number): void;
  locate?(x: number, y?: number): void;
  pset?(x: number, y: number, color?: number): void;
  line?(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color?: number,
    box?: string,
  ): void;
  circle?(x: number, y: number, radius: number, color?: number): void;
  point?(x: number, y: number): number;
  paint?(x: number, y: number, fill: number, border: number): void;
  beep?(): void;
  cursor?(): { x: number; y: number };
  speed?(): number;
  now?(): number;
}
export interface SessionIO {
  getSource(): string;
  setSource(source: string): void;
  print(text: string): void;
  readPrograms?(): Record<string, string>;
  writePrograms?(programs: Record<string, string>): void;
}
