"use client";

export type WaveDirection = "left" | "right";
export type Stance = "regular" | "goofy";

type Props = {
  waveDirection: WaveDirection | null;
  stance: Stance | null;
  onWaveDirection: (v: WaveDirection) => void;
  onStance: (v: Stance) => void;
  disabled?: boolean;
};

function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-medium text-white/70">{label}</span>
        <span className="text-[11px] text-white/30">{hint}</span>
      </div>
      <div className="flex bg-white/[0.04] border border-subtle rounded-xl p-1 gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 rounded-lg text-[13px] transition-all ${
              value === opt.value
                ? "bg-ocean-light text-ocean-deep font-semibold"
                : "text-white/55 hover:text-white/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Two quick context taps that materially sharpen the analysis:
 * stance × wave direction together pin down frontside vs backside
 * (camera-independent), which we can't recover from pose alone.
 */
export default function RideContextPicker({
  waveDirection,
  stance,
  onWaveDirection,
  onStance,
  disabled,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Segmented<Stance>
        label="Your stance"
        hint="lead foot"
        value={stance}
        disabled={disabled}
        onChange={onStance}
        options={[
          { value: "regular", label: "Regular" },
          { value: "goofy", label: "Goofy" },
        ]}
      />
      <Segmented<WaveDirection>
        label="Wave direction"
        hint="way it peels"
        value={waveDirection}
        disabled={disabled}
        onChange={onWaveDirection}
        options={[
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ]}
      />
    </div>
  );
}
