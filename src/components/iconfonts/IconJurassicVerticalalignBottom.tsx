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

const IconJurassicVerticalalignBottom: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M64 896h896v64H64z"
        fill={getIconColor(color, 0, '#727272')}
      />
      <path
        d="M192 832V64h256v768z"
        fill={getIconColor(color, 1, '#497CAD')}
      />
      <path
        d="M576 832V320h256v512z"
        fill={getIconColor(color, 2, '#B3B3B3')}
      />
    </svg>
  );
};

IconJurassicVerticalalignBottom.defaultProps = {
  size: 18,
};

export default IconJurassicVerticalalignBottom;
