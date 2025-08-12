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

const IconJurassicVerFensanAlign: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M896 128h64v768h-64zM768 128h64v768h-64zM640 128h64v768h-64zM512 128h64v768h-64z"
        fill={getIconColor(color, 0, '#727272')}
      />
      <path
        d="M448 583.8l-128 128V312.2l128 128V256L256 64 64 256v184.2l128-128v399.6l-128-128V768l192 192 192-192z"
        fill={getIconColor(color, 1, '#497CAD')}
      />
    </svg>
  );
};

IconJurassicVerFensanAlign.defaultProps = {
  size: 18,
};

export default IconJurassicVerFensanAlign;
