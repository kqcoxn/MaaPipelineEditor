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

const IconJixu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 0a512 512 0 1 1 0 1024A512 512 0 0 1 512 0z m0 102.4a409.6 409.6 0 1 0 0 819.2A409.6 409.6 0 0 0 512 102.4z"
        fill={getIconColor(color, 0, '#0091FF')}
      />
      <path
        d="M459.995429 294.180571l245.76 187.977143a36.571429 36.571429 0 0 1 0 59.684572l-245.76 187.977143A36.571429 36.571429 0 0 1 402.285714 699.977143V324.022857a36.571429 36.571429 0 0 1 57.709715-29.842286z"
        fill={getIconColor(color, 1, '#0091FF')}
      />
    </svg>
  );
};

IconJixu.defaultProps = {
  size: 18,
};

export default IconJixu;
