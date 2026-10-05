/**
 * Iconos: Phosphor en peso «regular», un trazo fino y uniforme en toda la interfaz.
 * Siempre decorativos (`aria-hidden`); el texto accesible lo pone quien los usa.
 * Se importan de la entrada `ssr`, que funciona igual en componentes de servidor y de cliente.
 */
import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowDown,
  ArrowRight,
  ArrowSquareOut,
  CaretRight,
  Check,
  Code,
  Copy,
  Eye,
  Keyboard,
  MagnifyingGlass,
  MagnifyingGlassPlus,
  Minus,
  Path,
  Stop,
  Warning,
  X,
} from '@phosphor-icons/react/ssr';
import type { ComponentType } from 'react';

type Props = Omit<IconProps, 'weight'> & { size?: number };

function glyph(Glyph: ComponentType<IconProps>, name: string) {
  function Icon({ size = 20, ...rest }: Props) {
    return <Glyph size={size} weight="regular" aria-hidden="true" focusable="false" {...rest} />;
  }
  Icon.displayName = name;
  return Icon;
}

export const IconArrowRight = glyph(ArrowRight, 'IconArrowRight');
export const IconArrowDown = glyph(ArrowDown, 'IconArrowDown');
export const IconExternal = glyph(ArrowSquareOut, 'IconExternal');
export const IconChevron = glyph(CaretRight, 'IconChevron');
export const IconCheck = glyph(Check, 'IconCheck');
export const IconCode = glyph(Code, 'IconCode');
export const IconCopy = glyph(Copy, 'IconCopy');
export const IconEye = glyph(Eye, 'IconEye');
export const IconKeyboard = glyph(Keyboard, 'IconKeyboard');
export const IconLens = glyph(MagnifyingGlass, 'IconLens');
export const IconZoom = glyph(MagnifyingGlassPlus, 'IconZoom');
export const IconSkip = glyph(Minus, 'IconSkip');
export const IconRoute = glyph(Path, 'IconRoute');
export const IconStop = glyph(Stop, 'IconStop');
export const IconWarning = glyph(Warning, 'IconWarning');
export const IconFail = glyph(X, 'IconFail');
