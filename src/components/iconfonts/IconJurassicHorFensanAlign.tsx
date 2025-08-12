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

const IconJurassicHorFensanAlign: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M128 896h768v64H128zM128 768h768v64H128zM128 640h768v64H128zM128 512h768v64H128zM0 64h64v896H0zM960 64h64v896h-64z"
        fill={getIconColor(color, 0, '#727272')}
      />
      <path
        d="M440.2 448l-128-128h399.6l-128 128H768l192-192L768 64H583.8l128 128H312.2l128-128H256L64 256l192 192z"
        fill={getIconColor(color, 1, '#497CAD')}
      />
    </svg>
  );
};

IconJurassicHorFensanAlign.defaultProps = {
  size: 18,
};

export default IconJurassicHorFensanAlign;
