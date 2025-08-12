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

const IconJurassicHorizalignCenter: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M480 64h64v896h-64z"
        fill={getIconColor(color, 0, '#727272')}
      />
      <path
        d="M256 192h512v256H256z"
        fill={getIconColor(color, 1, '#B3B3B3')}
      />
      <path
        d="M128 576h768v256H128z"
        fill={getIconColor(color, 2, '#497CAD')}
      />
    </svg>
  );
};

IconJurassicHorizalignCenter.defaultProps = {
  size: 18,
};

export default IconJurassicHorizalignCenter;
