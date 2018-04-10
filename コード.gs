function myFunction() {
  
  // 今日のカレンダーイベントを取得
  var events = CalendarApp.getDefaultCalendar().getEventsForDay(new Date());
  
  // お知らせしたい予定を取得して、予定の開始時刻に動的にトリガーをセット
  for(var i=0; i < events.length; i++) {
    if(events[i].getTitle() == "見積TIME (対象がない場合は通常作業実行でOK)"){
      var functionName = "estimatePush";
      var hours = events[i].getStartTime().getHours();
      var minutes = events[i].getStartTime().getMinutes();
      setTrigger(functionName,hours,minutes);
    } else if(events[i].getTitle() == "スプリント 残件整理TIME") {
      var functionName = "retrospectivePush";
      var hours = events[i].getStartTime().getHours();
      var minutes = events[i].getStartTime().getMinutes();
      setTrigger(functionName,hours,minutes);
    }
  }
}



// hipchatにメッセージを投稿する関数
function hipchat(message) {
  // hipchatの情報を記載しているシートからトークンとルームIDを取得
  var hipchatSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('hipchat');
  var authToken = hipchatSheet.getRange(1, 2).getValue();
  var roomId = hipchatSheet.getRange(2, 2).getValue();
  
  var url = 'https://api.hipchat.com/v2/room/' + roomId + '/notification?auth_token=' + authToken;
  var payload =
      {
        color          : 'gray',
        message        : message,
        notify         : true,
        message_format : 'text'
      };
  var params =
      {
        method       : 'post',
        contentType  : 'application/json; charset=utf-8',
        payload      : JSON.stringify(payload)
      };
  var res = UrlFetchApp.fetch(url, params);
}

// コンフルからタイトルとして渡されたキーワードを検索して返却する関数
function confluence(title) {
  // コンフルの情報を記載しているシートからトークンとルームIDを取得
  var confluenceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('confluence');
  var userid = confluenceSheet.getRange(1, 2).getValue();
  var password = confluenceSheet.getRange(2, 2).getValue();
  
  var url = "https://manabo.atlassian.net/wiki/rest/api/content/search?cql=title=" +  "'" + title + "'";
  
  var options = 
      {
        "method" : "GET",
        "headers" : {"Authorization" : " Basic " + Utilities.base64Encode(userid + ":" + password)}
      }
  var response = UrlFetchApp.fetch(url, options);
  response = JSON.parse(response);
  if( response["results"].length > 0 ) {
    confluUrl = response["results"][0]["_links"]["webui"];
    return confluUrl;
  }
}

// 時間と分を渡してもらって動的にトリガーを設定する関数
function setTrigger(functionName,hours,minutes) {
  var triggerDay = new Date();
  triggerDay.setHours(hours);
  triggerDay.setMinutes(minutes);
  ScriptApp.newTrigger(functionName).timeBased().at(triggerDay).create();
}

// 関数名を渡して動的にトリガーを削除する関数
function deleteTrigger(functionName) {
  var triggers = ScriptApp.getProjectTriggers();
  for(var i=0; i < triggers.length; i++) {
    if(triggers[i].getHandlerFunction() == functionName){
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// 見積もりTIMEのお知らせ送信する関数
function estimatePush() {
  // トリガーを削除する
  deleteTrigger("estimatePush");
  var message = "見積もりTIMEになりました。エンジニアの方はPeparingでアサインされているissueのお見積もりをお願いいたします。";
  hipchat(message); // Development
}

// 残件整理TIMEのお知らせ送信する関数
function retrospectivePush() {
  // トリガーを削除する
  deleteTrigger("retrospectivePush");
  // 振り返りMTGの議事録の名前が"yyyymmdd Retrospective"となるので"yyyymmdd"の値を取得する
  var date = Utilities.formatDate(new Date(), 'JST', 'yyyyMM');
  // 振り返りMTGの日程は基本水曜だが、議事録作成者が日付を間違えても大丈夫なように周辺の日付を取得
  var days = [new Date().getDate(),new Date().getDate() - 1, new Date().getDate() + 1, new Date().getDate() - 2, new Date().getDate() + 2 ];
  
  // 日付が10日より小さいときに01~09になるようにする
  days.map(function(value, index, array){
    if ( value < 10){
      array[index] = "0" + value
    }
  })
  
  var url ;
  
  // days分コンフルの議事録ページを検索、それでもなかった場合は親ページのURLをurlにセット
  for(var i=0; i < days.length; i++) {
    var title = date + days[i] + " Retrospective";
    url = confluence(title);
    if ( url !== undefined ){
      url = "https://manabo.atlassian.net/wiki" + url;
      break;
    } else if ( url == undefined && i == days.length - 1 ) {
      url = "https://manabo.atlassian.net/wiki/spaces/BTOC/pages/20971534/Retrospectives+-"
    }
  }
  
  var message = "振り返りMTGの30分前になりましたので、各自残件整理と気づいた点の記載をお願いいたします。\n" + url 
  hipchat(message); // Development
}
