import Image from 'next/image';

type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <Image
      src="/tensr_logo_light.png"
      alt=""
      aria-hidden
      width={96}
      height={24}
      className={className ?? 'h-6 w-auto'}
      style={{ width: 'auto', height: '24px' }}
    />
  );
}
