import { Info, Languages, RefreshCw, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_AUTHOR, APP_VERSION } from "../core/app-info";
import { translate, type Language } from "../core/i18n";
import { isTauriRuntime } from "../platform/runtime";
import {
  checkForAppUpdate,
  UpdateInstallError,
  type UpdateCheckResult,
  type UpdateInstallProgress,
} from "../platform/updater";
import { useWorkspaceStore } from "../store/workspace-store";
import { Hint } from "./Hint";

type SettingsPanelProps = {
  showTrigger?: boolean;
};

export function SettingsPanel({ showTrigger = true }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [installProgress, setInstallProgress] = useState<UpdateInstallProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const language = useWorkspaceStore((state) => state.language);
  const setLanguage = useWorkspaceStore((state) => state.setLanguage);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const isInstalling = installProgress !== null;

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen("open-settings", () => setOpen(true)))
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  async function handleCheckUpdates() {
    setIsChecking(true);
    setUpdateResult(null);
    setInstallError(null);
    setInstallProgress(null);
    try {
      setUpdateResult(await checkForAppUpdate());
    } catch {
      setUpdateResult(null);
      window.alert(t("updateFailed"));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleInstallUpdate(update: Extract<UpdateCheckResult, { status: "available" }>) {
    const shouldInstall = window.confirm(`${t("updateAvailable")} ${update.version}. ${t("installUpdate")}?`);
    if (!shouldInstall) {
      return;
    }

    setInstallError(null);
    setInstallProgress({ phase: "downloading", downloadedBytes: 0, totalBytes: null });

    try {
      await update.install(setInstallProgress);
    } catch (error) {
      setInstallProgress(null);
      if (error instanceof UpdateInstallError && error.code === "running-from-dmg") {
        setInstallError(t("updateFromDmg"));
        return;
      }

      const detail = error instanceof Error ? error.message : String(error);
      setInstallError(detail ? `${t("updateInstallFailed")}: ${detail}` : t("updateInstallFailed"));
    }
  }

  const installPercent =
    installProgress?.phase === "downloading" && installProgress.totalBytes
      ? Math.min(100, Math.round((installProgress.downloadedBytes / installProgress.totalBytes) * 100))
      : null;
  const installStatus = installProgress
    ? installProgress.phase === "downloading"
      ? `${t("downloadingUpdate")}${installPercent === null ? "" : ` ${installPercent}%`}`
      : installProgress.phase === "installing"
        ? t("installingUpdate")
        : t("restartingApp")
    : null;

  return (
    <>
      {showTrigger && (
        <Hint text={t("settings")}>
          <button
            aria-label={t("settings")}
            className="icon-button"
            data-testid="settings-button"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Settings size={16} />
          </button>
        </Hint>
      )}

      {open && (
        <div className="modal-backdrop settings-backdrop" role="presentation">
          <section aria-label={t("settingsTitle")} className="info-modal settings-modal" data-testid="settings-modal">
            <div className="modal-heading">
              <h2>{t("settingsTitle")}</h2>
              <button
                aria-label={t("close")}
                className="icon-button"
                disabled={isInstalling}
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="settings-section">
              <h3>
                <Languages size={15} />
                {t("languageSettings")}
              </h3>
              <label className="field">
                {t("language")}
                <select
                  data-testid="language-select"
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  value={language}
                >
                  <option value="zh">{t("chinese")}</option>
                  <option value="en">{t("english")}</option>
                </select>
              </label>
            </div>

            <div className="settings-section">
              <h3>
                <Info size={15} />
                {t("about")}
              </h3>
              <dl className="info-list compact-info-list">
                <div>
                  <dt>{t("version")}</dt>
                  <dd>{APP_VERSION}</dd>
                </div>
                <div>
                  <dt>{t("author")}</dt>
                  <dd>{APP_AUTHOR}</dd>
                </div>
              </dl>
            </div>

            <div className="settings-section">
              <h3>
                <RefreshCw size={15} />
                {t("checkUpdates")}
              </h3>
              <p className="settings-hint">{t("checkUpdatesHint")}</p>
              <button
                className="button secondary"
                disabled={isChecking || isInstalling}
                onClick={() => void handleCheckUpdates()}
                type="button"
              >
                <RefreshCw size={16} />
                {isChecking ? t("checkingUpdates") : t("checkUpdates")}
              </button>
              {updateResult?.status === "latest" && <p className="settings-result">{t("noUpdates")}</p>}
              {updateResult?.status === "desktop-only" && <p className="settings-result">{t("updateDesktopOnly")}</p>}
              {updateResult?.status === "available" && (
                <div className="update-card">
                  <strong>
                    {t("updateAvailable")} {updateResult.version}
                  </strong>
                  {updateResult.notes && <p>{updateResult.notes}</p>}
                  {installStatus && (
                    <div className="update-progress" role="status">
                      <progress max={100} value={installPercent ?? undefined} />
                      <span>{installStatus}</span>
                    </div>
                  )}
                  {installError && (
                    <p className="update-error" role="alert">
                      {installError}
                    </p>
                  )}
                  <button
                    className="button primary"
                    disabled={isInstalling}
                    onClick={() => void handleInstallUpdate(updateResult)}
                    type="button"
                  >
                    {installStatus ?? t("installUpdate")}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
