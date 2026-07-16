/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconZengjiatianjiajiajian: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M874.24 150.016C777.6 53.376 648.96 0.256 512 0.256s-265.6 53.12-362.24 149.76c-199.68 199.68-199.68 524.16 0 723.84 96.64 96.64 225.28 149.76 362.24 149.76s265.6-53.12 362.24-149.76c96.64-96.64 149.76-224.64 149.76-361.6s-53.12-265.6-149.76-362.24z m-72.32 652.16c-77.44 76.8-180.48 119.68-289.92 119.68-109.44 0-212.48-42.88-289.92-119.68-160-160-160-419.84 0-579.2 77.44-77.44 180.48-119.68 289.92-119.68 109.44 0 212.48 42.88 289.92 119.68 77.44 77.44 119.68 180.48 119.68 289.92 0 109.44-42.88 211.84-119.68 289.28z m-85.12-341.12h-153.6v-153.6c0-28.16-23.04-51.2-51.2-51.2s-51.2 23.04-51.2 51.2v153.6h-153.6c-28.16 0-51.2 23.04-51.2 51.2s23.04 51.2 51.2 51.2h153.6v153.6c0 28.16 23.04 51.2 51.2 51.2s51.2-23.04 51.2-51.2v-153.6h153.6c28.16 0 51.2-23.04 51.2-51.2s-23.04-51.2-51.2-51.2z"
        fill={getIconColor(color, 0, '#FF4A4A')}
      />
    </svg>
  );
};

IconZengjiatianjiajiajian.defaultProps = {
  size: 18,
};

export default IconZengjiatianjiajiajian;
