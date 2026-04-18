export type MasonryItemSize = {
  id: string;
  width: number;
  height: number;
};

export type PackedMasonryItem = MasonryItemSize & {
  x: number;
  y: number;
};

type PackOptions = {
  width: number;
  gutter: number;
};

export type PackedMasonryItems = PackedMasonryItem[] & {
  height: number;
};

export function packMasonryItems(items: MasonryItemSize[], options: PackOptions): PackedMasonryItems {
  const placed: PackedMasonryItem[] = [];

  for (const item of items) {
    const candidates = getCandidateXPositions(placed, item, options);
    let bestX = 0;
    let bestY = Number.POSITIVE_INFINITY;

    for (const candidateX of candidates) {
      const candidateY = findLowestAvailableY(placed, item, candidateX, options.gutter);

      if (candidateY < bestY || (candidateY === bestY && candidateX < bestX)) {
        bestX = candidateX;
        bestY = candidateY;
      }
    }

    placed.push({ ...item, x: bestX, y: bestY });
  }

  const height = placed.reduce((maxHeight, item) => Math.max(maxHeight, item.y + item.height), 0);

  Object.defineProperty(placed, "height", {
    enumerable: false,
    value: height,
  });

  return placed as PackedMasonryItems;
}

function getCandidateXPositions(placed: PackedMasonryItem[], item: MasonryItemSize, options: PackOptions) {
  const maxX = Math.max(0, options.width - item.width);
  const candidates = new Set([0]);

  for (const placedItem of placed) {
    const nextX = placedItem.x + placedItem.width + options.gutter;

    if (nextX <= maxX) {
      candidates.add(nextX);
    }
  }

  return Array.from(candidates).sort((a, b) => a - b);
}

function findLowestAvailableY(
  placed: PackedMasonryItem[],
  item: MasonryItemSize,
  candidateX: number,
  gutter: number,
) {
  let candidateY = 0;
  let moved = true;

  while (moved) {
    moved = false;

    for (const placedItem of placed) {
      if (rectanglesOverlapWithGutter({ ...item, x: candidateX, y: candidateY }, placedItem, gutter)) {
        candidateY = placedItem.y + placedItem.height + gutter;
        moved = true;
      }
    }
  }

  return candidateY;
}

function rectanglesOverlapWithGutter(item: PackedMasonryItem, placedItem: PackedMasonryItem, gutter: number) {
  return (
    item.x < placedItem.x + placedItem.width + gutter &&
    item.x + item.width + gutter > placedItem.x &&
    item.y < placedItem.y + placedItem.height + gutter &&
    item.y + item.height + gutter > placedItem.y
  );
}
