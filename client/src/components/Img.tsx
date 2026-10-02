import type { ImageRef } from "../../../shared/types";

interface Props {
  image: ImageRef;
  alt: string;
  /** atributo sizes; descreva a largura renderizada */
  sizes: string;
  className?: string;
  priority?: boolean;
}

/** Imagem responsiva com dimensões reservadas (evita deslocamento de layout) e lazy loading por padrão. */
export function Img({ image, alt, sizes, className, priority }: Props) {
  return (
    <img
      src={image.src}
      srcSet={image.srcset}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      // @ts-expect-error atributo ainda não tipado no React 18
      fetchpriority={priority ? "high" : undefined}
    />
  );
}
