import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Car illustration. The catalogue images are SVGs, which next/image serves as-is (`unoptimized`);
 * width/height reserve the 2:1 box so there is no layout shift.
 */
export function CarImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1120}
      height={560}
      sizes={sizes}
      priority={priority}
      unoptimized={src.endsWith(".svg")}
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
