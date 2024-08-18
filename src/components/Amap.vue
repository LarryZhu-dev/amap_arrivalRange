<script setup lang="ts">
import AMapLoader from '@amap/amap-jsapi-loader';
import { ref, onMounted } from 'vue'
import { ElRadioGroup, ElRadioButton, ElSlider, ElButton, ElScrollbar } from 'element-plus'
import { Search, Delete } from '@element-plus/icons-vue'
import * as turf from '@turf/turf'
import autolog from 'autolog.js';

onMounted(async () => {
  await initAMap()
})

let AMap: any
let map: any
let arrivalRange: any
let geocoder: any
let polygons: { lnglat: [number, number], polygon: any, bounds: any }[] = []
let placeSearch: any

const strategy = ["地铁+公交", "地铁", "公交"] as const
const polygonStyle = {
  normal1: {
    fillColor: "#ffff00",
    fillOpacity: "0.4",
    strokeColor: "#ac916a",
    strokeOpacity: "0.1",
    strokeWeight: 3
  },
  normal2: {
    fillColor: "#0000ff",
    fillOpacity: "0.4",
    strokeColor: "#2c74dc",
    strokeOpacity: "0.1",
    strokeWeight: 3
  },
  overlap: {
    fillColor: "#14ac79",
    fillOpacity: "0.6",
    strokeColor: "#168369",
    strokeOpacity: "0.5",
    strokeWeight: 3
  }
}

type via = (typeof strategy)[number]

const currStrategy = ref("地铁+公交")
const currTime = ref(60)
const currPositionList = ref<{ name: string, lnglat: [number, number] }[]>([])



async function initAMap() {
  window._AMapSecurityConfig = {
    securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
  };
  AMap = await AMapLoader.load({
    key: import.meta.env.VITE_AMAP_KEY, // 申请好的Web端开发者Key，首次调用 load 时必填
    version: "2.0", // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
    plugins: ["AMap.ArrivalRange", "AMap.Geocoder", "AMap.GeoJSON", "AMap.PlaceSearch"], //需要使用的的插件列表，如比例尺'AMap.Scale'，支持添加多个如：['...','...']
  })
  map = new AMap.Map("Amap", {
    center: [116.397428, 39.90923],
  });
  map.on("click", handleMapClick);
  arrivalRange = new AMap.ArrivalRange()
  geocoder = new AMap.Geocoder();
}

function handleMapClick(e: any) {
  if (!e.lnglat) return
  if (currPositionList.value.length >= 2) {
    autolog.log("最多添加 2 个位置", 'error')
    return
  }
  var lnglat = e.lnglat;
  geocoder.getAddress(lnglat, (status: string, result: {
    regeocode: any; info: string;
  }) => {
    if (status === "complete" && result.info === "OK") {
      currPositionList.value.push({ name: result.regeocode.formattedAddress, lnglat: [lnglat.lng, lnglat.lat] })
    }
  });
}

function getArriveRange() {
  clearPolygons()
  let loopCount = 0
  for (let item of currPositionList.value) {
    arrivalRange.search(item.lnglat, currTime.value, (_status: any, result: { bounds: any; }) => {
      map.remove(polygons);
      if (!result.bounds) return
      let currPolygons = []
      loopCount++
      for (let item of result.bounds) {
        let polygon = new AMap.Polygon(polygonStyle[`normal${loopCount}` as "normal1" | "normal2"]);
        polygon.setPath(item);
        currPolygons.push(polygon)
      }
      map.add(currPolygons);
      polygons.push({
        lnglat: item.lnglat,
        polygon: currPolygons,
        bounds: result.bounds
      })
      if (loopCount === currPositionList.value.length) {
        let poly1 = turf.multiPolygon(toNumber(polygons[0].bounds));
        let poly2 = turf.multiPolygon(toNumber(polygons[1].bounds));
        var intersection = turf.intersect(turf.featureCollection([poly1, poly2]));
        if (intersection) {
          let geojson = new AMap.GeoJSON({
            geoJSON: {
              type: "FeatureCollection",
              features: [intersection]
            },
            getPolygon: (_: any, lnglats: any) => {
              return new AMap.Polygon({
                path: lnglats,
                ...polygonStyle.overlap
              });
            }
          });
          // placeSearch = new AMap.PlaceSearch({ //构造地点查询类
          //   pageSize: 5, // 单页显示结果条数
          //   pageIndex: 1, // 页码
          //   // map: map, // 展现结果的地图实例
          //   panel: "result", // 结果列表将在此容器中进行展示。
          //   autoFitView: true // 是否自动调整地图视野使绘制的 Marker点都处于视口的可见范围
          // });
          // placeSearch.search('小区', geojson);
          polygons.push({
            lnglat: [0, 0],
            polygon: geojson,
            bounds: intersection.geometry.coordinates
          })
          map.add(geojson);
        } else {
          autolog.log("暂无交集，请自行查找", 'error')
        }
        console.log('intersection::: ', intersection);
        map.setFitView();
      }
    }, { policy: currStrategy.value });
  }
}

// 递归的将多维数组内的字符串转为数字
function toNumber(arr: any) {
  return arr.map((item: any) => {
    if (Array.isArray(item)) {
      return toNumber(item)
    } else {
      return Number(item)
    }
  })
}
function clearPolygons(keepPosition = true) {
  for (let polygon of polygons) {
    map.remove(polygon.polygon)
  }
  polygons = []
  !keepPosition && (currPositionList.value = [])
}
function removePolygon(polygon?: { lnglat: [number, number], polygon: any }) {
  if (!polygon) return
  map.remove(polygon.polygon)
  polygons = polygons.filter((item) => item.lnglat !== polygon.lnglat)
}
function removePosition(position: { name: string, lnglat: [number, number] }) {
  currPositionList.value = currPositionList.value.filter((item) => item.name !== position.name)
  removePolygon(polygons.find((item) => item.lnglat === position.lnglat))
}
</script>

<template>
  <div id="Amap"></div>
  <div id="result"></div>
  <div class="optionsMenu">
    <span class="title">控制选项</span>
    <div class="optionsBody">
      <div class="optionItem">
        <span class="name">出行方式</span>
        <el-radio-group v-model="currStrategy" size="default">
          <el-radio-button v-for="item in strategy" :label="item" :value="item" />
        </el-radio-group>
      </div>
      <div class="optionItem">
        <span class="name">出行耗时</span>
        <el-slider v-model="currTime" :max="60" />
        <span class="unit">{{ currTime }} (分钟)</span>
      </div>
      <div class="optionItem">
        <span class="name">出行位置</span>
        <div class="positions">
          <el-scrollbar height="100%">
            <div class="positionItem" v-for="position in currPositionList" v-if="currPositionList.length">
              <span class="postionName">{{ position.name }}</span>
              <span class="posiotionLnglat">{{ position.lnglat.join(",") }}</span>
              <span class="remove" @click="removePosition(position)">×</span>
            </div>
            <div v-else class="tip">点击地图添加位置</div>
          </el-scrollbar>
        </div>
      </div>
      <div class="submit">
        <el-button type="primary" :icon="Search" @click="getArriveRange">查询</el-button>
        <el-button circle :icon="Delete" @click="clearPolygons(false)"></el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.read-the-docs {
  color: #888;
}

#Amap {
  width: 100%;
  height: 100%;
}

#result {
  position: fixed;
  top: 10px;
  right: 10px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.optionsMenu {
  position: fixed;
  top: 10px;
  left: 10px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  color: #666;
  padding: 16px;
  max-height: 90vh;

  .optionsBody {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;

    .submit {
      display: flex;
      justify-content: center;
    }
  }

  .optionItem {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    max-width: 100%;

    .positions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      max-height: 300px;
      height: auto;
      width: 100%;

      .tip {
        font-size: 12px;
        color: #999;
      }

      .positionItem {
        display: flex;
        flex-direction: column;
        background: #ffffffec;
        width: 100%;
        position: relative;
        padding-left: 10px;
        cursor: pointer;
        padding: 6px;
        transition: .2s;

        &:hover .remove {
          opacity: 1;
        }

        .remove {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #ff0000e3;
          cursor: pointer;
          width: 20px;
          height: 20px;
          border-radius: 1000px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: .2s;

          &:hover {
            background: #ffcaca;
          }
        }

        &:hover {
          background: #f5f5f5;
        }

        &::after {
          content: "";
          display: block;
          height: 12px;
          width: 2px;
          background: #0085fe;
          position: absolute;
          top: 10px;
          left: 0;
        }

        .postionName {
          font-size: 12px;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 310px;
        }

        .posiotionLnglat {
          font-size: 12px;
          color: #999;
        }
      }
    }

    .name,
    .unit {
      font-size: 14px;
      color: #999;
      white-space: nowrap;
    }
  }

  .title {
    display: inline-flex;
    align-items: center;
    font-size: 16px;
    position: relative;
    padding-left: 10px;
    margin-bottom: 18px;
    line-height: 16px;

    &:after {
      content: "";
      display: block;
      height: 100%;
      width: 2px;
      background: #0085fe;
      position: absolute;
      left: 0;
    }
  }
}
</style>
<style>
.amap-content-body {
  color: #000;
}
</style>