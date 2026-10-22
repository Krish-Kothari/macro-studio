interface Window {
  macroSystem?: {
    openUrl(url: string): Promise<boolean>;
    chooseApplication(): Promise<string | undefined>;
    openApplication(applicationPath: string): Promise<boolean>;
  };
}
