interface Window {
  macroSystem?: {
    openUrl(url: string): Promise<boolean>;
    chooseApplication(): Promise<string | undefined>;
    chooseMedia(): Promise<string | undefined>;
    openApplication(applicationPath: string): Promise<boolean>;
    playMedia(mediaPath: string): Promise<boolean>;
  };
}
