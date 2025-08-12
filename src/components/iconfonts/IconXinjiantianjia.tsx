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

const IconXinjiantianjia: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M749.1 751.8v169.6c0 1.4 1.4 2.4 2.7 1.9 79-28.9 141.5-91.6 169.9-170.8 0.5-1.3-0.5-2.7-1.9-2.7H751.1c-1.1 0-2 0.9-2 2z"
        fill={getIconColor(color, 0, '#F9DB88')}
      />
      <path
        d="M891.3 87.4H132.8c-26.2 0-47.4 21.2-47.4 47.4v758.5c0 26.2 21.2 47.4 47.4 47.4h521.5c15.6 0 30.8-1.5 45.7-4 1-0.2 1.7-1 1.7-2V704.3c0-1.1 0.9-2 2-2H933c1 0 1.8-0.7 2-1.7 2.3-14.5 3.8-29.3 3.8-44.4V134.8c-0.1-26.2-21.3-47.4-47.5-47.4zM700.9 561.5H561.4c-1.1 0-2 0.9-2 2V703c0 25.2-19.4 46.6-44.6 48.1-27.4 1.6-50.2-20.3-50.2-47.3V563.5c0-1.1-0.9-2-2-2H323.2c-25.2 0-46.6-19.4-48.1-44.6-1.6-27.4 20.3-50.3 47.3-50.3h140.2c1.1 0 2-0.9 2-2V325.3c0-25.2 19.4-46.6 44.6-48.1 27.4-1.6 50.2 20.3 50.2 47.3v140.2c0 1.1 0.9 2 2 2h140.2c27 0 48.9 22.9 47.3 50.2-1.4 25.3-22.8 44.6-48 44.6z"
        fill={getIconColor(color, 1, '#009F72')}
      />
    </svg>
  );
};

IconXinjiantianjia.defaultProps = {
  size: 18,
};

export default IconXinjiantianjia;
