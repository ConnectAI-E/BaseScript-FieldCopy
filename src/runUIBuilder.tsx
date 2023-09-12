import { bitable, FieldType, checkers } from "@lark-base-open/js-sdk";
import $ from 'jquery';
/*
Text = 1,
Number = 2,
SingleSelect = 3,
MultiSelect = 4,
DateTime = 5,
Checkbox = 7,
User = 11,
Phone = 13,
Url = 15,
Attachment = 17,
SingleLink = 18,
Lookup = 19,
Formula = 20,
DuplexLink = 21,
Location = 22,
GroupChat = 23,
//*/
const fieldType_List_All = [1, 2, 3, 4, 5, 7, 11, 13, 15, 17, 18, 19, 20, 21, 22, 23];
export default async function main(uiBuilder: any) {
  uiBuilder.form((form: any) => ({
    formItems: [
      form.tableSelect('table_source', { label: '选择源数据表、视图和数据字段' }),
      form.viewSelect('view_source', { label: '', sourceTable: 'table_source' }),
      form.fieldSelect('field_source', {
        label: '',
        sourceTable: 'table_source',
        filter: ({ type }: { type: any }) => (fieldType_List_All.indexOf(type) >= 0),
      }),
      form.tableSelect('table_target', { label: '选择目标数据表和数据字段' }),
      form.fieldSelect('field_target', {
        label: '',
        sourceTable: 'table_target',
        filter: ({ type }: { type: any }) => (fieldType_List_All.indexOf(type) >= 0 && type !== 19 && type !== 20),
      }),
      form.fieldSelect('field_source_related', {
        label: '源表与目标表关联字段（请保证整列数据的唯一性，推荐使用文本、数字、单选做为关联字段）',
        sourceTable: 'table_source',
        filter: ({ type }: { type: any }) => (fieldType_List_All.indexOf(type) >= 0),
      }),
      form.fieldSelect('field_target_related', {
        label: '',
        sourceTable: 'table_target',
        filter: ({ type }: { type: any }) => (fieldType_List_All.indexOf(type) >= 0),
      }),
    ],
    buttons: ['字段数据复制'],

  }), async ({ values }: { values: any }) => {
    const { table_source, view_source, field_source, field_source_related, table_target, field_target, field_target_related } = values;
    // console.log(values);

    if (typeof view_source === 'undefined') { alert("请选择源表视图。"); return; };
    if (typeof field_source === 'undefined') { alert("请选择源表数据字段。"); return; };
    if (typeof field_target === 'undefined') { alert("请选择目标表数据字段。"); return; };
    if (table_source !== table_target) {
      if (typeof field_source_related === 'undefined') { alert("请选择源表与目标表关联字段。"); return; };
      if (typeof field_target_related === 'undefined') { alert("请选择目标表与源表关联字段。"); return; };
    }

    uiBuilder.showLoading('正在准备复制字段数据');
    let date0: any = new Date();
    console.log("开始字段数据复制：", date0);
    let fieldValueList: any = [];
    let source_fieldMeta: any = "";
    let target_fieldMeta: any = "";
    let source_related_fieldMeta: any = "";
    let target_related_fieldMeta: any = "";
    let target_related_fieldValueList: any = "";
    try {
      source_fieldMeta = await field_source.getMeta();
      target_fieldMeta = await field_target.getMeta();

      if (table_source !== table_target) {
        source_related_fieldMeta = await field_source_related.getMeta();
        target_related_fieldMeta = await field_target_related.getMeta();

        if (source_related_fieldMeta.type !== target_related_fieldMeta.type) {
          if (confirm("源表关联字段与目标表关联字段类型不一致，是否仍然继续执行?")) {
            console.log("继续执行");
          }
          else {
            console.log("取消执行");
            uiBuilder.hideLoading();
            return;
          }
        }
        target_related_fieldValueList = await field_target_related.getFieldValueList();

        const viewId = await view_source.id;
        let hasMore = true;
        let pageSize = 500;
        let pageToken = "";
        let dataindex = 0
        let date1: any = new Date();
        console.log("开始读取源表数据：", date1);
        while (hasMore) {
          const source_recordValueList = await table_source.getRecords({ pageSize: pageSize, pageToken: pageToken, viewId: viewId });
          pageToken = source_recordValueList.pageToken;
          hasMore = source_recordValueList.hasMore;
          const get_records = source_recordValueList.records;

          for (var i = 0; i < get_records.length; i++) {
            uiBuilder.showLoading('正在读取源表第 ' + String(dataindex + 1) + ' 条数据');
            const value = {
              recordId: get_records[i].recordId,
              value: get_records[i].fields[field_source.id],
              field_source_related: get_records[i].fields[field_source_related.id]
            }
            fieldValueList.push(value);
            dataindex += 1;
          }
        }
        let date2: any = new Date();
        console.log("结束读取源表数据：", date2);
        console.log("读取源表数据总耗时：", (date2 - date1) / 1000);
      } else {
        fieldValueList = await field_source.getFieldValueList();
      }

    } catch (e) {
      alert("接口调用失败，请刷新后重试");
      uiBuilder.hideLoading();
      return;
    }

    uiBuilder.hideLoading();
    uiBuilder.showLoading('正在准备转换数据并写入目标表字段');

    let update_recordsList: any = [];
    let update_fieldsList: any = {};
    let count = 0, index = 0;
    let check_flag: any = false;
    let list_len = fieldValueList.length
    let target_fieldType = [2, 3, 5, 7, 13, 22];
    let date3: any = new Date();
    console.log("开始转换并写入数据：", date3);
    if (list_len === 0) {
      alert("获取源表字段数据为空，请切换数据表检查后重试");
      uiBuilder.hideLoading();
      return;
    }
    for (let fieldValue of fieldValueList) {  // 循环源表数据列表
      uiBuilder.showLoading('正在转换并写入第 ' + String(index + 1) + ' / ' + String(list_len) + ' 条数据')
      // console.log(fieldValue);
      let cellValue: any = fieldValue.value;

      if (source_fieldMeta.type === 19 || source_fieldMeta.type === 20) {
        if (target_fieldType.indexOf(target_fieldMeta.type) >= 0) {
          cellValue = cellValue[0];
        }
      }
      // console.log(cellValue);

      // 以下为检验源字段类型及判断目标字段的匹配性
      if (!check_flag) {
        if (source_fieldMeta.type === 1) {
          if (target_fieldMeta.type !== 1) {
            alert("【文本】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 2) {
          if (target_fieldMeta.type !== 2) {
            alert("【数字】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 3) {
          if (target_fieldMeta.type !== 3) {
            alert("【单选】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 4) {
          if (target_fieldMeta.type !== 4) {
            alert("【多选】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 5) {
          if (target_fieldMeta.type !== 5) {
            alert("【日期】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 7) {
          if (target_fieldMeta.type !== 7) {
            alert("【复选框】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 11) {
          if (target_fieldMeta.type !== 11) {
            alert("【用户】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 13) {
          if (target_fieldMeta.type !== 13) {
            alert("【电话号码】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 15) {
          if (target_fieldMeta.type !== 15) {
            alert("【链接】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 17) {
          if (target_fieldMeta.type !== 17) {
            alert("【附件】类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 18 || source_fieldMeta.type === 21) {
          if (target_fieldMeta.type !== 18 && target_fieldMeta.type !== 21) {
            alert("【单向关联/双向关联】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 22) {
          if (target_fieldMeta.type !== 22) {
            alert("【地理定位】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else if (source_fieldMeta.type === 23) {
          if (target_fieldMeta.type !== 23) {
            alert("【群组】字段类型与目标字段类型不匹配，请重新选择");
            uiBuilder.hideLoading();
            return;
          }
        } else {
          if (source_fieldMeta.type !== 19 && source_fieldMeta.type !== 20) {
            console.log("不支持的字段类型，请重新选择");
            uiBuilder.hideLoading();
            return;
          } else {
            if (target_fieldMeta.type === 18 || target_fieldMeta.type === 21) {
              alert("【查找引用/公式】字段类型不支持写入【单向/双向关联】字段，请重新选择");
              uiBuilder.hideLoading();
              return;
            }
          }
        }
        check_flag = true;
      }

      if (table_source === table_target) {  // 同表内的字段数据复制

        if (target_fieldMeta.type === 3) {   // 目标字段类型为“单选”时取值
          const fieldMeta_Options = target_fieldMeta.property.options;
          for (let fieldMeta_Options_item of fieldMeta_Options) {
            if (fieldMeta_Options_item.name === (cellValue as any).text) {
              update_fieldsList[field_target.id] = fieldMeta_Options_item;
              break;
            }
          }
        } else if (target_fieldMeta.type === 4) {   // 目标字段类型为“多选”时取值
          const fieldMeta_Options = target_fieldMeta.property.options;
          let new_cellValue: any = [];
          for (let cellValue_item of cellValue) {
            for (let fieldMeta_Options_item of fieldMeta_Options) {
              if (fieldMeta_Options_item.name === cellValue_item.text) {
                new_cellValue.push(fieldMeta_Options_item);
                break;
              }
            }
          }
          update_fieldsList[field_target.id] = new_cellValue;
        } else {   // 目标字段类型为“其它”时取值
          update_fieldsList[field_target.id] = cellValue;
        }

        update_recordsList.push({ recordId: fieldValue.record_id, fields: update_fieldsList });
        update_fieldsList = [];

      } else {  // 不同表之间的字段数据复制
        ///////
        // 获取源表索引列字段的值
        let field_source_related = "";
        switch (source_related_fieldMeta.type) {
          case 1:
            field_source_related = String(fieldValue.field_source_related[0].text);
            break;
          case 2:
          case 5:
          case 13:
            field_source_related = String(fieldValue.field_source_related);
            break;
          case 3:
            field_source_related = String(fieldValue.field_source_related.text);
            break;
          default:
            field_source_related = JSON.stringify(fieldValue.field_source_related);
            break;
        }
        ///////

        for (let j = 0; j < target_related_fieldValueList.length; j++) {  // 循环目标数据表关联字段的数据
          ///////
          // 获取目标表索引列字段的值
          let field_target_related = "";
          switch (target_related_fieldMeta.type) {
            case 1:
              field_target_related = String(target_related_fieldValueList[j].value[0].text);
              break;
            case 2:
            case 5:
            case 13:
              field_target_related = String(target_related_fieldValueList[j].value);
              break;
            case 3:
              field_target_related = String(target_related_fieldValueList[j].value.text);
              break;
            default:
              field_target_related = JSON.stringify(target_related_fieldValueList[j].value);
              break;
          }
          ///////
          if (field_source_related === field_target_related) {
            if (target_fieldMeta.type === 3) {   // 目标字段类型为“单选”时取值
              const fieldMeta_Options = target_fieldMeta.property.options;
              for (let fieldMeta_Options_item of fieldMeta_Options) {
                if (fieldMeta_Options_item.name === cellValue.text) {
                  update_fieldsList[field_target.id] = fieldMeta_Options_item;
                  break;
                }
              }
            } else if (target_fieldMeta.type === 4) {   // 目标字段类型为“多选”时取值
              const fieldMeta_Options = target_fieldMeta.property.options;
              let new_cellValue: any = [];
              for (let cellValue_item of cellValue) {
                for (let fieldMeta_Options_item of fieldMeta_Options) {
                  if (fieldMeta_Options_item.name === cellValue_item.text) {
                    new_cellValue.push(fieldMeta_Options_item);
                    break;
                  }
                }
              }
              update_fieldsList[field_target.id] = new_cellValue;
            } else {   // 目标字段类型为“其它”时取值
              update_fieldsList[field_target.id] = cellValue;
            }
            update_recordsList.push({ recordId: target_related_fieldValueList[j].record_id, fields: update_fieldsList });
            update_fieldsList = [];
            break;
          }
        }

      }

      count++;
      // 达到500条记录或循环结束时写入数据表
      if (count === 500 || index === fieldValueList.length - 1) {
        // 如果写入失败，可重试两次
        let retry = 0, retry_max = 3;
        while (retry < retry_max) {
          try {
            await table_target.setRecords(update_recordsList);
            await new  Promise(resolve => { setTimeout(resolve, 500);});
            count = 0;
            update_recordsList = [];
            retry = retry_max;
          } catch (e) {
            retry += 1;
          }
        }

      }
      index++;
    }
    let date4: any = new Date();
    console.log("结束转换并写入数据：", date4);
    console.log("转换并写入数据总耗时：", (date4 - date3) / 1000);
    console.log("字段数据复制总耗时：", (date4 - date0) / 1000);

    uiBuilder.hideLoading();

  });

  $(document).ready(function() {
    console.log("加载完成");
  });
}

