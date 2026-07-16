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

const IconJurassicNextstep: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M298.6 337.2c3.5-0.8 7.2-1.2 11.2-1.2h469.5L597.7 154.4c-20.5-20.6-20.5-54.2 0-74.9 10-10 23.3-15.5 37.5-15.5 14.1 0 27.5 5.5 37.5 15.5l271.9 271.8c1.7 1.7 2.7 3.3 3.4 4.6 2.8 3.5 5.9 7.6 8 12.8 2.1 5 3.3 10.5 3.7 16.7 0.2 0.9 0.3 2.1 0.3 3.4 0 1.7-0.2 3.1-0.4 4.1-0.4 5.8-1.5 11-3.4 15.8l-0.1 0.3c-2.2 5.3-5.3 10.1-9.4 14.8l-0.8 1.3-273.3 273.2c-9.9 9.9-23.2 15.4-37.4 15.4-14 0-27.2-5.4-37.3-15.3l-0.1-0.1c-20.6-20.6-20.7-54.3 0-75l181.6-181.5H316.2c-28.6 8-146.2 50.8-146.2 214.9 0 166.2 124.3 194 143.7 197.4h106.9c29.2 0 53 23.8 53 53s-23.8 52.9-53 52.9H309.8c-2 0-4.1-0.1-6.4-0.4-19.8-2.4-89.3-15-151.1-74.5-26.9-25.9-48.1-56.9-62.8-92.1C72.6 752.7 64 706.9 64 656.7c0-213.2 153.3-302.2 234.6-319.5z"
        fill={getIconColor(color, 0, '#497CAD')}
      />
    </svg>
  );
};

IconJurassicNextstep.defaultProps = {
  size: 18,
};

export default IconJurassicNextstep;
