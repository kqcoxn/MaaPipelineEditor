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

const IconWenjianpeizhi: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M940.352 295.808h-870.4v-108.8a108.8 108.8 0 0 1 108.8-108.8h652.8a108.8 108.8 0 0 1 108.8 108.8v108.8z m0 54.4v489.6a108.8 108.8 0 0 1-108.8 108.8h-652.8a108.8 108.8 0 0 1-108.8-108.8v-489.6h870.4z m-61.696-136a54.4 54.4 0 1 0-94.208-54.4 54.4 54.4 0 0 0 94.208 54.4z m-163.2 0a54.4 54.4 0 1 0-94.208-54.4 54.4 54.4 0 0 0 94.208 54.4z m-163.2 0a54.4 54.4 0 1 0-94.208-54.4 54.4 54.4 0 0 0 94.208 54.4zM311.296 622.016l53.312-54.528c12.8-13.12 12.8-34.048 0-47.168a32 32 0 0 0-46.016 0L242.752 598.08a33.6 33.6 0 0 0-9.6 23.936 33.472 33.472 0 0 0 9.536 24l75.84 77.696a32 32 0 0 0 46.08 0 33.792 33.792 0 0 0 0-47.04l-53.312-54.656zM566.464 461.44a32.256 32.256 0 0 0-42.368 18.24l-125.376 314.24a33.6 33.6 0 0 0 17.92 43.392c3.84 1.6 8 2.496 12.224 2.496a32.512 32.512 0 0 0 30.08-20.672L584.32 504.96a33.6 33.6 0 0 0-17.792-43.456z m210.688 160.64a33.6 33.6 0 0 0-9.472-24L691.84 520.32a32 32 0 0 0-46.08 0c-12.8 13.12-12.8 34.048 0 47.168l53.248 54.528-53.248 54.656a33.792 33.792 0 0 0 0 47.04 32.064 32.064 0 0 0 46.016 0l75.84-77.696a33.344 33.344 0 0 0 9.6-23.936z"
        fill={getIconColor(color, 0, '#4E73FF')}
      />
    </svg>
  );
};

IconWenjianpeizhi.defaultProps = {
  size: 18,
};

export default IconWenjianpeizhi;
