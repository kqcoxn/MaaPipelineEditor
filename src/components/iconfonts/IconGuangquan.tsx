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

const IconGuangquan: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M282.524257 470.5026L549.300031 1.355017q-18.468884-1.355017-37.290072-1.355017c-157.723995 0-298.781279 71.314552-392.697516 183.46932zM430.61408 292.832753h544.229083C903.867365 143.198211 762.471327 33.468923 593.50069 6.449882zM360.559694 690.448982L269.123138 529.676199l-10.203279-17.615223 0.081301-0.135502L92.293401 218.699766a512.887536 512.887536 0 0 0-60.325362 471.749216zM663.609277 333.551018l101.24688 178.049252 0.230353 0.135502-0.081301 0.135501 166.789059 293.30701a512.873986 512.873986 0 0 0 60.244062-471.627265zM741.549862 553.117995l-266.938376 469.526988q18.550185 1.355017 37.452674 1.355017c157.805296 0 298.943881-71.395853 392.860118-183.659023zM593.392289 731.180797H49.163206C120.139004 880.761139 261.521492 990.517527 430.546329 1017.617869z"
        fill={getIconColor(color, 0, '#1296db')}
      />
    </svg>
  );
};

IconGuangquan.defaultProps = {
  size: 18,
};

export default IconGuangquan;
