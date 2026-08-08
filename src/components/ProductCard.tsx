"use client";

type ProductCardData = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

export default function ProductCard({
  product,
  onClick,
  quantity = 0,
  onIncrement,
  onDecrement,
  compact = false,
}: {
  product: ProductCardData;
  onClick: () => void;
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  compact?: boolean;
}) {
  const priceLabel = product.price === 0 ? "0円" : `${product.price}円`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-neutral-200 text-left shadow-sm active:opacity-80 ${
        product.imageUrl ? "bg-white" : "flex flex-col items-center justify-center gap-1 bg-neutral-50 px-2 text-center"
      }`}
    >
      {product.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 ${
              compact ? "pt-3" : "pt-6"
            }`}
          >
            <span className={`block truncate font-medium text-white ${compact ? "text-xs" : "text-sm"}`}>
              {product.name}
            </span>
            <span className={`block text-white/80 ${compact ? "text-[10px]" : "text-xs"}`}>{priceLabel}</span>
          </div>
        </>
      ) : (
        <>
          <span className={`font-medium text-neutral-800 ${compact ? "text-xs" : "text-sm"}`}>
            {product.name}
          </span>
          <span className={`text-neutral-500 ${compact ? "text-[10px]" : "text-xs"}`}>{priceLabel}</span>
        </>
      )}

      {(onIncrement || onDecrement) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-white/95 shadow ${
            compact ? "px-0.5 py-0.5" : "px-1 py-1"
          }`}
        >
          {quantity > 0 && (
            <>
              <button
                type="button"
                onClick={onDecrement}
                className={`flex items-center justify-center rounded-full font-bold text-neutral-700 hover:bg-neutral-100 ${
                  compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
                }`}
              >
                −
              </button>
              <span
                className={`min-w-[1em] text-center font-semibold text-neutral-800 ${
                  compact ? "text-[10px]" : "text-xs"
                }`}
              >
                {quantity}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={onIncrement}
            className={`flex items-center justify-center rounded-full font-bold text-neutral-700 hover:bg-neutral-100 ${
              compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
            }`}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
