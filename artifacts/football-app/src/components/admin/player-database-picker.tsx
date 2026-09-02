import { useState } from "react";
import { getListPlayersQueryKey, useListPlayers } from "@workspace/api-client-react";
import { Check, Loader2, Search, UserRound, X } from "lucide-react";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";

export type ExistingPlayer = {
  id: number;
  teamId: number;
  playerName: string;
  playerCode: string | null;
  playerNumber: string | null;
  position: string | null;
  photoUrl: string | null;
  nationality: string | null;
  teamName: string;
  teamShortName: string | null;
  teamLogoUrl: string | null;
  teamSport: string;
};

type PlayerDatabasePickerProps = {
  selectedPlayer: ExistingPlayer | null;
  onSelect: (player: ExistingPlayer) => void;
  onClear: () => void;
};

export function PlayerDatabasePicker({
  selectedPlayer,
  onSelect,
  onClear,
}: PlayerDatabasePickerProps) {
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();
  const canSearch = trimmedSearch.length >= 2;
  const { data: players, isFetching } = useListPlayers(
    canSearch ? { q: trimmedSearch } : undefined,
    {
      query: {
        enabled: canSearch,
        staleTime: 30_000,
        queryKey: getListPlayersQueryKey(canSearch ? { q: trimmedSearch } : undefined),
      },
    },
  );

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-start gap-2">
        <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-bold text-foreground">Find player in database</p>
          <p className="text-[10px] text-muted-foreground">
            Search by player code, name, or team before creating a new record.
          </p>
        </div>
      </div>

      {selectedPlayer ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
          {selectedPlayer.photoUrl ? (
            <img
              src={selectedPlayer.photoUrl}
              alt={selectedPlayer.playerName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-black text-foreground">
              {selectedPlayer.playerName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-foreground">{selectedPlayer.playerName}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {selectedPlayer.playerCode || "No player code"} · {selectedPlayer.teamShortName || selectedPlayer.teamName}
            </p>
          </div>
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          <button
            type="button"
            onClick={() => {
              setSearch("");
              onClear();
            }}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Clear selected player"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type player code or name…"
              className="admin-input w-full pl-9"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary" />
            )}
          </div>

          {canSearch && !isFetching && (
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {players && players.length > 0 ? (
                players.slice(0, 8).map((player) => (
                  <button
                    type="button"
                    key={`${player.id}-${player.playerCode ?? player.playerName}`}
                    onClick={() => {
                      setSearch("");
                      onSelect(player as ExistingPlayer);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-primary/10"
                  >
                    {player.teamLogoUrl ? (
                      <TeamLogo
                        url={player.teamLogoUrl}
                        name={player.teamName ?? "Team"}
                        shortName={player.teamShortName}
                        className="h-7 w-7"
                      />
                    ) : (
                      <UserRound className="ml-1 h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-foreground">{player.playerName}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {player.playerCode || "No code"} · {player.teamShortName || player.teamName}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className={cn("px-2 py-2 text-[11px] text-muted-foreground")}>
                  No player found. Fill in the fields below to create a new player.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}