(function() {
  var db = objectDB.open('timesheet', {entries: {}}),
      days = 'Sun Mon Tues Wed Thurs Fri Sat'.split(' '),
      months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
      today = new Date(),
      now = today.getTime(),
      dayms = 24*60*60*1000,
      tasks = {},
      task, hours, entries, add, form, suggest, report, first, last;
  var model = function(data, insert) {
    var keys = !Array.isArray(data) && Object.keys(data),
        model, elem;
    return model = {
      get: function(key) {
        if (key == null) return data;
        return data[key];
      },
      remove: function(key) {
        var index = keys ? keys.indexOf(key) : key;
        if (index >= 0) {
          if (keys) {
            keys.splice(index, 1);
            delete data[key];
          } else {
            data.splice(index, 1);
          }
          if (elem) elem.removeChild(elem.childNodes[index]);
        }
        return model;
      },
      insert: function(value, key) {
        var index = key == null ? data.length : key;
        if (keys) {
          if ((index = keys.indexOf(key)) < 0) {
            index = keys.length;
            keys.push(key);
          } else if (elem) {
            elem.removeChild(elem.childNodes[index]);
          }
          data[key] = value;
        } else {
          data.splice(index, 0, value);
        }
        if (elem) elem.insertBefore(jsml(insert(value, key, index, model)), elem.childNodes[index]);
        return model;
      },
      insertAll: function(values) {
        if (keys) {
          Object.keys(values).forEach(function(key) {
            model.insert(values[key], key);
          });
        } else {
          values.forEach(function(value) {
            model.insert(value);
          });
        }
        return model;
      },
      view: function(parent) {
        var data_ = data;
        elem = parent;
        data = keys ? {} : [];
        keys = keys && [];
        model.insertAll(data_);
      }
    };
  }
  var dateString = function(d) {
    var y = d.getFullYear(),
        m = d.getMonth()+1,
        d = d.getDate();
    return [y, m < 10 ? '0'+m : m, d < 10 ? '0'+d : d].join('-');
  };
  var dateIcon = function(date, click) {
    return {div: {
      className: 'date '+days[date.getDay()].toLowerCase(),
      dataset: {date: dateString(date)},
      onclick: click,
      children: [{div: days[date.getDay()]}, months[date.getMonth()]+' '+date.getDate()]
    }};
  };
  try {
    db.get('entries', false, function(path) {
      if (path.length) return function(task) { tasks[task] = 1; };
    });
  } catch (e) {
    return jsml({div: {className: 'error', children: 'Your browser does not fully support indexedDB.'}}, document.body);
  }
  jsml([
    {header: [
      {h1: 'Timesheet'},
      {nav: [
        {span: {className: 'record-tab', children: 'Record', onclick: function() { document.body.className = 'show-record'; }}},
        {span: {className: 'report-tab', children: 'Report', onclick: function() { document.body.className = 'show-report'; }}}
      ]},
      {div: {className: 'record', children: function(e) {
        form = e;
        return [
          dateIcon(today),
          {div: {className: 'task', children: [
            {input: {type: 'text', placeholder: 'task', autofocus: true, children: function(e) {
              task = e;
            }, onkeyup: function(e) {
              var value = this.value;
              jsml((value.length < 2 ? [] : Object.keys(tasks).filter(function(item) {
                return ~item.toLowerCase().indexOf(value.toLowerCase());
              })).map(function(item) {
                return {li: {children: item, onclick: function() {
                  e.target.value = item;
                  jsml(null, suggest, true);
                  hours.focus();
                }}};
              }), suggest, true);
            }, onfocus: function() {
              suggest.style.display = 'block';
            }, onblur: function() {
              setTimeout(function() {
                suggest.style.display = 'none'; // TODO: more elegant solution?
              }, 500);
            }}},
            {ul: function(e) { suggest = e; }}
          ]}},
          {input: {type: 'number', min: '0', max: '24', step: '.5', className: 'hours', placeholder: 'hours', children: function(e) { hours = e; }}},
          {button: {children: function(e) { add = e; return 'Add'; }, disabled: true, onclick: function(e) {
            this.disabled = true;
            var name = task.value,
                date = dateString(today),
                time = parseFloat(hours.value);
            if (!time || time < 0) {
              this.disabled = false;
              alert('Invalid number of hours');
              hours.focus();
            } else {
              var success = function() {
                e.target.disabled = false;
                entries.get(date).insert(time, name);
                tasks[name] = 1;
              };
              db.put('entries/'+date+'/'+encodeURIComponent(name), time).then(function(e) {
                if (!e) return success();
                var record = {}; record[name] = time;
                db.put('entries/'+date, record).then(success);
              });
            }
          }}}
        ];
      }}},
      {div: {className: 'report', children: new Array(36 + today.getDay()).join().split(',').map(function(x, i, days) {
        return dateIcon(new Date(now-(days.length-i-1)*dayms), function() {
          if (this == first) {
            first = last;
            last = null;
          } else if (this == last) {
            last = null;
          } else if (first) {
            last = this;
          } else {
            first = this;
          }
          var range = first && last,
              values = [], end;
          for (var node = this.parentNode.firstChild; node; node = node.nextSibling) {
            if (end = node == first || node == last)
              values.push(node.dataset.date);
            node.classList.toggle('selected', end || range && values.length == 1);
          }
          if (!values.length) return jsml(null, report, true);
          db.get('entries', false, function(path) {
            if (!path.length) return {
              lowerBound: values[0],
              upperBound: range ? values[1] : values[0]
            };
          }).then(function(data) {
            var totals = {}, total = 0;
            Object.keys(data).forEach(function(date) {
              Object.keys(date = data[date]).forEach(function(task) {
                totals[task] = (totals[task] || 0) + date[task];
              });
            });
            var tasks = Object.keys(totals);
            jsml([
              {ul: tasks.sort().concat([1]).map(function(task, i) {
                var last = i == tasks.length,
                    time = last ? total : totals[task];
                if (!last) total += time;
                return {li: {className: last ? 'total' : '', children: [
                  {div: {className: 'time', children: time+' h'}},
                  {div: {className: 'name', children: last ? 'Total' : task}}
                ]}};
              })},
              !tasks.length || {a: {
                href: 'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(totals)),
                download: 'timesheet.json',
                className: 'download',
                children: 'Download'
              }}
            ], report, true);
          });
        });
      })}}
    ]},
    {div: {className: 'content', children: [
      {div: {className: 'record', children: [
        {ul: (entries = model({}, function(value, date) {
          date = date.split('-');
          date = new Date(date[0], parseInt(date[1], 10)-1, parseInt(date[2], 10));
          return {li: [
            dateIcon(date, function() {
              form.replaceChild(jsml(dateIcon(today = date)), form.firstChild);
            }),
            {ul: value.view}
          ]};
        })).view},
        {button: {className: 'previous', children: function(e) {
          var page = 0, days = 7;
          (e.onclick = function() {
            e.disabled = true;
            var end = new Date(now-page*days*dayms);
            db.get('entries', false, function(path) {
              if (!path.length) return {
                lowerBound: dateString(new Date(end.getTime() - (days-1)*dayms)),
                upperBound: dateString(end),
                descending: true
              };
            }).then(function(data) {
              e.textContent = 'Previous';
              e.disabled = add.disabled = false;
              new Array(days).join().split(',').forEach(function(x, i) {
                var date = dateString(new Date(now-(page*days+i)*dayms));
                entries.insert(model(data[date] || {}, function(hours, task, index, items) {
                  return {li: [
                    {button: {className: 'remove', children: '×', onclick: function(e) {
                      this.disabled = true;
                      db.delete('entries/'+date+'/'+encodeURIComponent(task)).then(function() {
                        items.remove(task);
                      });
                    }}},
                    {div: {className: 'time', children: hours+' h'}},
                    {div: {className: 'name', children: task}}
                  ]};
                }), date);
              });
              page++;
            });
          })();
          return 'Loading...';
        }}}
      ]}},
      {div: {className: 'report', children: function(e) { report = e; }}}
    ]}}
  ], document.body);
}());