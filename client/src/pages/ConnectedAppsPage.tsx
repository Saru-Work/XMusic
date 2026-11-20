import { useState } from "react";
import { useSelector } from "react-redux";
import { Check, PlugZap } from "lucide-react";
import type { RootState } from "../store/store";
import { api, errorMessage, useApi } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState, PageTitle, Spinner, secondaryButton } from "../components/States";
import LoginPrompt from "../components/LoginPrompt";

interface Grant {
  id: string;
  clientName: string;
  scopes: { id: string; description: string }[];
  createdAt: string;
  lastUsedAt: string;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

/** Apps (like ChatGPT) the listener allowed to use their account */
const ConnectedAppsPage = () => {
  const user = useSelector((s: RootState) => s.user.user);
  const { data, error, loading, setData, reload } = useApi<{ grants: Grant[] }>(user ? "/oauth/grants" : null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  if (!user) return <LoginPrompt message="Log in to see the apps connected to your account." />;

  async function disconnect(id: string) {
    setRemoving(id);
    setRemoveError(null);
    try {
      await api(`/oauth/grants/${id}`, { method: "DELETE" });
      setData((d) => ({ grants: d.grants.filter((g) => g.id !== id) }));
    } catch (err) {
      setRemoveError(errorMessage(err));
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <PageTitle title="Connected apps" />
      <p className="mb-6 max-w-2xl text-sm text-gray-400">
        Apps you've allowed to use your XMusic account, such as ChatGPT. Disconnecting one stops it right
        away; you can connect it again from the app.
      </p>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.grants.length === 0 && (
        <EmptyState icon={PlugZap} title="No connected apps">
          <p className="max-w-sm">
            To control XMusic from ChatGPT, add XMusic as a connector in ChatGPT and approve it when asked.
          </p>
        </EmptyState>
      )}
      {removeError && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {removeError}
        </p>
      )}

      {data && data.grants.length > 0 && (
        <ul className="flex max-w-2xl flex-col gap-3">
          {data.grants.map((grant) => (
            <li
              key={grant.id}
              className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-pink-500 font-semibold text-white">
                  {grant.clientName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-white">{grant.clientName}</p>
                  <p className="text-xs text-gray-400">
                    Connected {formatDate(grant.createdAt)} · last used {formatDate(grant.lastUsedAt)}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {grant.scopes.map((scope) => (
                      <li key={scope.id} className="flex items-start gap-2 text-xs text-gray-300">
                        <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" />
                        {scope.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {confirming === grant.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" className={secondaryButton} onClick={() => setConfirming(null)} disabled={removing !== null}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => disconnect(grant.id)}
                    disabled={removing !== null}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {removing === grant.id && <Spinner size={14} />}
                    Disconnect
                  </button>
                </div>
              ) : (
                <button type="button" className={`${secondaryButton} shrink-0`} onClick={() => setConfirming(grant.id)}>
                  Disconnect
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ConnectedAppsPage;
