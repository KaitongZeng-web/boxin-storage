import React from 'react';
import {Platform, StyleSheet, Text, TextInput, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

type Props = {value:string; compact?:boolean; onChange?:(value:string)=>void};

// A continuous torn edge scales with the note as its text grows.
const paperEdge = 'M5 9 L19 8 28 5 40 6 47 4 58 5 69 3 80 5 91 4 103 6 117 4 127 5 141 3 154 5 167 4 181 6 195 5 202 8 204 17 202 26 204 34 203 42 205 53 202 58 204 68 203 78 206 92 204 100 205 108 201 118 199 128 190 130 177 128 164 129 151 127 138 128 124 126 111 128 95 129 82 132 67 133 53 132 40 133 28 131 15 131 6 129 8 119 10 111 8 101 9 93 5 81 4 73 6 64 8 57 6 48 4 42 5 35 2 26 3 18 Z';

export function StickyNote({value,onChange,compact=false}:Props) {
  return <View style={styles.wrapper}>
    <View style={[styles.paper,compact&&styles.compactPaper]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 208 136" preserveAspectRatio="none">
          <Path d={paperEdge} fill="#D7C6A5" transform="translate(0 1)"/>
          <Path d={paperEdge} fill="#F2E5C9"/>
        </Svg>
      </View>
      {onChange ? <TextInput
        accessibilityLabel="便利签备注" numberOfLines={Math.min(12,Math.max(1,value.split('\n').length))} multiline maxLength={2000}
        placeholder="写下用途，或给自己留个提醒…" placeholderTextColor="#645342" cursorColor="#201A16"
        textAlignVertical="center" value={value} onChangeText={onChange}
        style={[styles.ink,styles.input]}
      /> : <Text selectable style={styles.ink}>{value || '还没有留下备注'}</Text>}
    </View>
    <View pointerEvents="none" style={styles.tape}>
      <Svg width="59" height="41" viewBox="0 0 59 41">
        <Path fill="#E6C6AC" fillOpacity={0.96} d="M2 2 L39 1 55 6 53 12 55 15 51 25 50 37 16 39 15 34 12 33 11 26 8 20 7 15 4 9 Z"/>
        <Path fill="#F5E0CF" d="M39 1 L55 6 53 12 46 9 Z"/>
        <Path fill="none" stroke="#D7C6A5" strokeWidth="1" d="M40 3 Q45 12 53 12 M17 37 L48 36"/>
      </Svg>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  wrapper:{width:'100%',maxWidth:430,alignSelf:'center',paddingTop:22,marginVertical:4},
  paper:{justifyContent:'center',minHeight:128,paddingHorizontal:22,paddingTop:26,paddingBottom:26},
  compactPaper:{minHeight:99,paddingHorizontal:16,paddingTop:22,paddingBottom:22},
  tape:{position:'absolute',top:1,alignSelf:'center',transform:[{rotate:'-2deg'}]},
  ink:{position:'relative',zIndex:1,textAlign:'center',fontWeight:'300',fontFamily:Platform.select({web:'STXingkai, 华文行楷, KaiTi, STKaiti, cursive',ios:'STKaiti',android:'cursive'}),fontSize:20,lineHeight:29,letterSpacing:0.6,color:'#201A16'},
  input:{minHeight:29,padding:0,backgroundColor:'transparent'},
});
