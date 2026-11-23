import React from 'react';
import Svg,{Path,Rect} from 'react-native-svg';
export function BoxArt({color,size=180}:{color:string;size?:number}){return <Svg width={size} height={size*.72} viewBox="0 0 240 175">
 <Path d="M34 61L150 79L213 52V137L150 166L34 144Z" fill={color}/>
 <Path d="M150 79L213 52V137L150 166Z" fill="#000" opacity=".15"/>
 <Path d="M25 37L89 13L222 34L155 62Z" fill={color}/>
 <Path d="M25 37L155 62V87L25 63Z" fill={color}/>
 <Path d="M155 62L222 34V60L155 87Z" fill={color}/>
 <Path d="M25 37L89 13L222 34L155 62Z" fill="#fff" opacity=".22"/>
 <Path d="M155 62L222 34V60L155 87Z" fill="#000" opacity=".2"/>
 <Path d="M25 63L155 87L222 60" stroke="#171512" strokeOpacity=".32" strokeWidth="2" fill="none"/>
 <Path d="M179 58L199 50Q204 48 204 53V57Q204 60 199 62L179 70Q175 72 175 67V63Q175 60 179 58Z" fill="#29231E"/>
 <Rect x="66" y="91" width="55" height="37" rx="3" fill="#F5EEE4" transform="rotate(9 66 91)"/>
 <Path d="M74 104L109 110M73 113L99 118" stroke="#B9AA99" strokeWidth="2"/>
 </Svg>}
