"use client";

import { useState } from "react";

// Google profile photo with an initial-letter fallback (never signed in, or
// the photo failed to load).
export default function Avatar({
  name,
  image,
  size = 28,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 font-bold text-neutral-500"
      style={style}
      aria-hidden
    >
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          // The image can fail before hydration attaches onError.
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setFailed(true);
          }}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        name.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}
